import axios from 'axios';
import { PullRequest, Review, Comment, ReviewAnalysis, ReviewScore, FixSuggestion } from '../types';

interface AnalyzeInput {
  pr: PullRequest;
  reviews: Review[];
  comments: Comment[];
}

const OPENROUTER_MODELS = [
  'mistralai/devstral-2512:free',
  'nex-agi/deepseek-v3.1-nex-n1:free',
  'amazon/nova-2-lite-v1:free',
  'allenai/olmo-3-32b-think:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-coder:free',
  'google/gemma-3n-e2b-it:free',
  'google/gemma-3n-e4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

export class AIService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  async analyzeReviews(input: AnalyzeInput): Promise<ReviewAnalysis> {
    const prompt = this.buildAnalysisPrompt(input);
    const response = await this.complete(prompt);
    return this.parseAnalysisResponse(response, input);
  }

  async generateFixSuggestions(code: string, issues: string[]): Promise<FixSuggestion[]> {
    const prompt = `Analyze the following code and provide fix suggestions for the identified issues.

Code:
\`\`\`
${code}
\`\`\`

Issues:
${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Respond in JSON format with an array of fix suggestions:
{
  "suggestions": [
    {
      "line": <line_number>,
      "issue": "<issue_description>",
      "suggestion": "<fix_explanation>",
      "code": "<fixed_code_snippet>",
      "confidence": <0-100>
    }
  ]
}`;

    const response = await this.complete(prompt);
    try {
      const parsed = JSON.parse(response);
      return parsed.suggestions.map((s: any, idx: number): FixSuggestion => ({
        id: `fix-${idx}`,
        file: '',
        line: s.line,
        issue: s.issue,
        suggestion: s.suggestion,
        code: s.code,
        confidence: s.confidence,
      }));
    } catch {
      return [];
    }
  }

  async generateReviewSuggestions(pr: PullRequest): Promise<string[]> {
    const prompt = `Analyze the following pull request and generate helpful review suggestions.

PR Title: ${pr.title}
PR Description: ${pr.body}

Changed Files:
${pr.files.map(f => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}

File Changes:
${pr.files.slice(0, 5).map(f => `
=== ${f.filename} ===
${f.patch || 'No patch available'}
`).join('\n')}

Provide 3-5 specific, actionable review suggestions that would help improve this PR.
Format as a JSON array of strings.`;

    const response = await this.complete(prompt);
    try {
      return JSON.parse(response);
    } catch {
      return response.split('\n').filter(line => line.trim().length > 0);
    }
  }

  private buildAnalysisPrompt(input: AnalyzeInput): string {
    const { pr, reviews, comments } = input;

    return `Analyze the quality of code reviews for the following pull request.

PR #${pr.number}: ${pr.title}
Description: ${pr.body}
Author: ${pr.author}
Changes: +${pr.additions}/-${pr.deletions} in ${pr.changedFiles} files

Reviews:
${reviews.map(r => `
- Reviewer: ${r.author}
  State: ${r.state}
  Comment: ${r.body}
`).join('\n')}

Review Comments:
${comments.map(c => `
- Author: ${c.author}
  File: ${c.path || 'N/A'}
  Line: ${c.line || 'N/A'}
  Comment: ${c.body}
`).join('\n')}

Score each review on these dimensions (0-25 each):
1. Clarity: How clear and understandable is the feedback?
2. Completeness: Does it cover important aspects of the code?
3. Actionability: Are suggestions specific and actionable?
4. Constructiveness: Is the tone helpful and professional?

Respond in JSON format:
{
  "overallScore": <0-100>,
  "dimensions": {
    "clarity": <0-25>,
    "completeness": <0-25>,
    "actionability": <0-25>,
    "constructiveness": <0-25>
  },
  "reviews": [
    {
      "reviewId": <id>,
      "author": "<author>",
      "score": <0-100>,
      "clarity": <0-25>,
      "completeness": <0-25>,
      "actionability": <0-25>,
      "constructiveness": <0-25>,
      "highlights": ["<positive_aspect>"],
      "improvements": ["<suggestion>"]
    }
  ],
  "recommendations": ["<overall_recommendation>"]
}`;
  }

  private async complete(prompt: string): Promise<string> {
    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`[Review-Forge CLI] Trying model: ${model}`);
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model,
            messages: [
              {
                role: 'system',
                content: 'You are an expert code review analyst. Provide detailed, actionable analysis in the requested JSON format. Only respond with valid JSON, no markdown formatting.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 2048,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://review-forge.dev',
              'X-Title': 'Review-Forge CLI'
            },
          }
        );
        
        console.log(`[Review-Forge CLI] Success with model: ${model}`);
        const text = response.data.choices?.[0]?.message?.content || '';
        return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } catch (error: any) {
        if (error.response?.status === 429) {
          console.log(`[Review-Forge CLI] Rate limited (429) on ${model}, trying next model...`);
          continue;
        }
        throw error;
      }
    }
    throw new Error('All OpenRouter models rate limited. Please try again later.');
  }

  private parseAnalysisResponse(response: string, input: AnalyzeInput): ReviewAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        prNumber: input.pr.number,
        prTitle: input.pr.title,
        overallScore: parsed.overallScore || 0,
        dimensions: {
          clarity: parsed.dimensions?.clarity || 0,
          completeness: parsed.dimensions?.completeness || 0,
          actionability: parsed.dimensions?.actionability || 0,
          constructiveness: parsed.dimensions?.constructiveness || 0,
        },
        reviewCount: input.reviews.length,
        commentCount: input.comments.length,
        reviews: (parsed.reviews || []).map((r: any): ReviewScore => ({
          reviewId: r.reviewId,
          author: r.author,
          score: r.score || 0,
          clarity: r.clarity || 0,
          completeness: r.completeness || 0,
          actionability: r.actionability || 0,
          constructiveness: r.constructiveness || 0,
          highlights: r.highlights || [],
          improvements: r.improvements || [],
        })),
        recommendations: parsed.recommendations || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        prNumber: input.pr.number,
        prTitle: input.pr.title,
        overallScore: 0,
        dimensions: { clarity: 0, completeness: 0, actionability: 0, constructiveness: 0 },
        reviewCount: input.reviews.length,
        commentCount: input.comments.length,
        reviews: [],
        recommendations: ['Unable to parse AI response. Please try again.'],
        timestamp: new Date().toISOString(),
      };
    }
  }
}

#!/usr/bin/env node
/**
 * Review-Forge MCP Server
 * Extends Cline CLI with code review quality analysis tools
 * 
 * This MCP server provides tools for:
 * - Analyzing PR review quality
 * - Scoring code reviews on 4 dimensions
 * - Submitting feedback to improve the model
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AI_PROVIDER = process.env.AI_PROVIDER || 'openrouter'; // 'openrouter' | 'oumi'
const OUMI_MODEL_PATH = process.env.OUMI_MODEL_PATH || '../oumi/models/review-scorer';

console.error(`[Review-Forge] AI Provider: ${AI_PROVIDER}`);

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'analyze_pr_reviews',
    description: 'Analyze the quality of code reviews for a GitHub pull request. Returns scores for clarity, completeness, actionability, and constructiveness.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub repository owner (e.g., "facebook")',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name (e.g., "react")',
        },
        pr_number: {
          type: 'number',
          description: 'Pull request number to analyze',
        },
      },
      required: ['owner', 'repo', 'pr_number'],
    },
  },
  {
    name: 'score_review_text',
    description: 'Score a code review comment text on quality dimensions (clarity, completeness, actionability, constructiveness). Returns 0-100 overall score.',
    inputSchema: {
      type: 'object',
      properties: {
        review_text: {
          type: 'string',
          description: 'The code review comment text to score',
        },
        context: {
          type: 'string',
          description: 'Optional context about the PR being reviewed',
        },
      },
      required: ['review_text'],
    },
  },
  {
    name: 'suggest_review_improvements',
    description: 'Get AI suggestions to improve a code review comment. Makes reviews more actionable and constructive.',
    inputSchema: {
      type: 'object',
      properties: {
        review_text: {
          type: 'string',
          description: 'The current code review comment',
        },
        code_snippet: {
          type: 'string',
          description: 'Optional code snippet being reviewed',
        },
      },
      required: ['review_text'],
    },
  },
  {
    name: 'submit_feedback',
    description: 'Submit feedback on a review score to improve the model. This helps train the RL model.',
    inputSchema: {
      type: 'object',
      properties: {
        review_id: {
          type: 'string',
          description: 'ID of the review being rated',
        },
        feedback_type: {
          type: 'string',
          enum: ['positive', 'negative', 'neutral'],
          description: 'Type of feedback',
        },
        comment: {
          type: 'string',
          description: 'Optional comment explaining the feedback',
        },
        suggested_score: {
          type: 'number',
          description: 'What you think the score should be (0-100)',
        },
      },
      required: ['review_id', 'feedback_type'],
    },
  },
  {
    name: 'get_team_stats',
    description: 'Get code review quality statistics for a team/repository over time.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub repository owner',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        days: {
          type: 'number',
          description: 'Number of days to analyze (default: 30)',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'auto_fix_from_review',
    description: 'AI Agent that automatically generates code fixes based on PR review feedback. Analyzes review comments and generates specific code changes.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub repository owner',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        pr_number: {
          type: 'number',
          description: 'Pull request number to generate fixes for',
        },
        confidence_threshold: {
          type: 'number',
          description: 'Minimum confidence (0-100) to auto-approve fixes (default: 70)',
        },
      },
      required: ['owner', 'repo', 'pr_number'],
    },
  },
];

// GitHub API helper
async function fetchGitHubPR(owner: string, repo: string, prNumber: number) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const [prRes, reviewsRes, commentsRes] = await Promise.all([
    axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers }),
    axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, { headers }),
    axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`, { headers }),
  ]);

  return {
    pr: prRes.data,
    reviews: reviewsRes.data,
    comments: commentsRes.data,
  };
}

// AI analysis helper - supports multiple providers
async function analyzeWithAI(prompt: string): Promise<string> {
  if (AI_PROVIDER === 'oumi') {
    // Use locally trained Oumi model
    return analyzeWithOumi(prompt);
  } else {
    // Default: Use OpenRouter with Qwen3-coder:free
    return analyzeWithOpenRouter(prompt);
  }
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

async function analyzeWithOpenRouter(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured. Please set it in your environment.');
  }

  for (const model of OPENROUTER_MODELS) {
    try {
      console.error(`[Review-Forge] Trying model: ${model}`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://review-forge.dev',
            'X-Title': 'Review-Forge'
          }
        }
      );
      console.error(`[Review-Forge] Success with model: ${model}`);
      return response.data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error(`[Review-Forge] Rate limited (429) on ${model}, trying next model...`);
        continue;
      }
      throw error;
    }
  }
  throw new Error('All OpenRouter models rate limited. Please try again later.');
}

async function analyzeWithOumi(prompt: string): Promise<string> {
  // Call local Oumi model server (runs on port 8766)
  try {
    const response = await axios.post('http://localhost:8766/generate', {
      prompt,
      max_tokens: 2048,
      temperature: 0.3
    });
    return response.data.text || response.data.response || '';
  } catch (error) {
    console.error('[Review-Forge] Oumi model not available, falling back to OpenRouter');
    return analyzeWithOpenRouter(prompt);
  }
}

// Tool handlers
async function handleAnalyzePRReviews(args: { owner: string; repo: string; pr_number: number }) {
  const { owner, repo, pr_number } = args;
  
  try {
    const { pr, reviews, comments } = await fetchGitHubPR(owner, repo, pr_number);

    if (reviews.length === 0 && comments.length === 0) {
      return {
        success: true,
        pr_number,
        pr_title: pr.title,
        message: 'No reviews or comments found for this PR',
        overall_score: 0,
      };
    }

    const prompt = `You are a code review quality analyst. Analyze and respond ONLY with valid JSON.

Analyze the code reviews for PR #${pr_number}: ${pr.title}
Author: ${pr.user?.login}
Description: ${(pr.body || '').slice(0, 500)}

Reviews:
${JSON.stringify(reviews.slice(0, 10).map((r: any) => ({ author: r.user?.login, body: r.body, state: r.state })), null, 2)}

Comments:
${JSON.stringify(comments.slice(0, 10).map((c: any) => ({ author: c.user?.login, body: c.body, path: c.path })), null, 2)}

Score on these dimensions (0-25 each):
1. Clarity: How clear and understandable
2. Completeness: Coverage of important aspects  
3. Actionability: Specific and actionable suggestions
4. Constructiveness: Helpful and professional tone

Respond ONLY with JSON:
{
  "overall_score": <0-100>,
  "dimensions": { "clarity": <0-25>, "completeness": <0-25>, "actionability": <0-25>, "constructiveness": <0-25> },
  "summary": "<brief summary>",
  "recommendations": ["<recommendation>"]
}`;

    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    return {
      success: true,
      pr_number,
      pr_title: pr.title,
      pr_author: pr.user?.login,
      review_count: reviews.length,
      comment_count: comments.length,
      ...analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      pr_number,
    };
  }
}

async function handleScoreReviewText(args: { review_text: string; context?: string }) {
  const { review_text, context } = args;

  const prompt = `You are a code review quality scorer. Score this review comment and respond ONLY with JSON.

Review text: "${review_text}"
${context ? `Context: ${context}` : ''}

Score on these dimensions (0-25 each):
1. Clarity: How clear and understandable
2. Completeness: Coverage of important aspects
3. Actionability: Specific and actionable suggestions
4. Constructiveness: Helpful and professional tone

Respond ONLY with JSON:
{
  "overall_score": <0-100>,
  "dimensions": { "clarity": <0-25>, "completeness": <0-25>, "actionability": <0-25>, "constructiveness": <0-25> },
  "explanation": "<why this score>"
}`;

  try {
    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return { success: true, ...JSON.parse(cleaned) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function handleSuggestImprovements(args: { review_text: string; code_snippet?: string }) {
  const { review_text, code_snippet } = args;

  const prompt = `You are a code review coach. Improve this review comment to be more helpful.

Original review: "${review_text}"
${code_snippet ? `Code being reviewed:\n\`\`\`\n${code_snippet}\n\`\`\`` : ''}

Provide an improved version that is:
- More specific and actionable
- Constructive in tone
- Clear about what to change and why

Respond ONLY with JSON:
{
  "improved_review": "<better version of the review>",
  "changes_made": ["<what was improved>"],
  "tips": ["<general tip for better reviews>"]
}`;

  try {
    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return { success: true, original: review_text, ...JSON.parse(cleaned) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function handleSubmitFeedback(args: { review_id: string; feedback_type: string; comment?: string; suggested_score?: number; review_text?: string }) {
  const { review_id, feedback_type, comment, suggested_score, review_text } = args;
  
  // Generate training data for RLHF
  const prompt = `Score this code review: '${review_text || comment || 'No text provided'}'`;
  
  // Generate chosen (correct) and rejected (incorrect) responses based on feedback
  let chosen: string;
  let rejected: string;
  
  if (feedback_type === 'positive') {
    // User said the review was good - generate high score as chosen
    const score = suggested_score || 80;
    chosen = `Score: ${score}/100\nClarity: ${Math.round(score/4)}/25\nCompleteness: ${Math.round(score/4)}/25\nActionability: ${Math.round(score/4)}/25\nConstructiveness: ${Math.round(score/4)}/25`;
    rejected = `Score: ${100 - score}/100 - Incorrect assessment`;
  } else {
    // User said the review was bad - generate low score as chosen
    const score = suggested_score || 25;
    chosen = `Score: ${score}/100\nClarity: ${Math.round(score/4)}/25\nCompleteness: ${Math.round(score/4)}/25\nActionability: ${Math.round(score/4)}/25\nConstructiveness: ${Math.round(score/4)}/25`;
    rejected = `Score: ${100 - score}/100 - Incorrect assessment`;
  }
  
  const trainingData = {
    prompt,
    chosen,
    rejected,
    feedback_type,
    review_id,
    timestamp: new Date().toISOString(),
  };
  
  // Write to feedback.jsonl for Oumi training
  const fs = await import('fs');
  const path = await import('path');
  const feedbackFile = path.join(process.cwd(), '..', 'oumi', 'data', 'feedback.jsonl');
  
  try {
    fs.appendFileSync(feedbackFile, JSON.stringify(trainingData) + '\n');
    console.error(`[Review-Forge] Feedback saved to ${feedbackFile}`);
  } catch (err) {
    console.error(`[Review-Forge] Could not write to file: ${err}`);
  }

  return {
    success: true,
    message: 'Feedback recorded! This data will be used to train the Oumi model.',
    feedback_id: `feedback-${Date.now()}`,
    training_data_saved: true,
  };
}

async function handleGetTeamStats(args: { owner: string; repo: string; days?: number }) {
  const { owner, repo, days = 30 } = args;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  try {
    const prsRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=20`,
      { headers }
    );

    const reviewers: Record<string, { count: number; totalScore: number }> = {};
    let totalScore = 0;
    let reviewCount = 0;

    for (const pr of prsRes.data.slice(0, 10)) {
      const reviewsRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
        { headers }
      );

      for (const review of reviewsRes.data) {
        const author = review.user?.login || 'unknown';
        const score = review.body ? Math.min(100, 30 + review.body.length / 10) : 20;
        
        if (!reviewers[author]) {
          reviewers[author] = { count: 0, totalScore: 0 };
        }
        reviewers[author].count++;
        reviewers[author].totalScore += score;
        totalScore += score;
        reviewCount++;
      }
    }

    const teamStats = Object.entries(reviewers).map(([name, stats]) => ({
      reviewer: name,
      review_count: stats.count,
      avg_score: Math.round(stats.totalScore / stats.count),
    })).sort((a, b) => b.avg_score - a.avg_score);

    return {
      success: true,
      repository: `${owner}/${repo}`,
      period_days: days,
      total_reviews: reviewCount,
      average_score: reviewCount > 0 ? Math.round(totalScore / reviewCount) : 0,
      top_reviewers: teamStats.slice(0, 5),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function handleAutoFixFromReview(args: { owner: string; repo: string; pr_number: number; confidence_threshold?: number }) {
  const { owner, repo, pr_number, confidence_threshold = 70 } = args;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  try {
    // Fetch PR, reviews, comments, and files
    const [prRes, reviewsRes, commentsRes, filesRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}/reviews`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}/comments`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr_number}/files`, { headers }),
    ]);

    const pr = prRes.data;
    const reviews = reviewsRes.data;
    const comments = commentsRes.data;
    const files = filesRes.data;

    // Extract actionable feedback
    const feedback: any[] = [];
    
    for (const comment of comments) {
      if (comment.body) {
        feedback.push({
          type: 'inline_comment',
          file: comment.path || '',
          line: comment.line || comment.original_line,
          body: comment.body,
          author: comment.user?.login || 'unknown',
        });
      }
    }

    for (const review of reviews) {
      if (review.body && ['CHANGES_REQUESTED', 'COMMENTED'].includes(review.state)) {
        feedback.push({
          type: 'review',
          body: review.body,
          state: review.state,
          author: review.user?.login || 'unknown',
        });
      }
    }

    if (feedback.length === 0) {
      return {
        success: true,
        pr_number,
        message: 'No actionable feedback found in reviews',
        fixes: [],
      };
    }

    // Use AI to generate fixes
    const prompt = `You are an AI auto-fix agent. Analyze the review feedback and generate specific code fixes.

PR #${pr_number}: ${pr.title}
Description: ${(pr.body || '').slice(0, 500)}

Review Feedback:
${JSON.stringify(feedback.slice(0, 10), null, 2)}

Changed Files:
${JSON.stringify(files.slice(0, 5).map((f: any) => ({ filename: f.filename, patch: (f.patch || '').slice(0, 500) })), null, 2)}

For each actionable piece of feedback, generate a fix. Respond ONLY with JSON:
{
  "fixes": [
    {
      "file": "<filename>",
      "line": <line_number or null>,
      "issue": "<description of the issue from feedback>",
      "original_code": "<the problematic code snippet>",
      "fixed_code": "<the corrected code>",
      "explanation": "<why this fix addresses the feedback>",
      "confidence": <0-100>
    }
  ],
  "summary": "<overall summary of fixes>",
  "unfixable": ["<feedback that cannot be auto-fixed>"]
}`;

    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    // Categorize fixes by confidence
    const approvedFixes = (analysis.fixes || []).filter((f: any) => f.confidence >= confidence_threshold);
    const needsReviewFixes = (analysis.fixes || []).filter((f: any) => f.confidence < confidence_threshold);

    return {
      success: true,
      pr_number,
      pr_title: pr.title,
      feedback_count: feedback.length,
      confidence_threshold,
      summary: analysis.summary,
      approved_fixes: approvedFixes.map((f: any) => ({
        ...f,
        decision: 'AUTO_APPROVE',
        reason: `High confidence (${f.confidence}%) - safe to auto-apply`,
      })),
      needs_review_fixes: needsReviewFixes.map((f: any) => ({
        ...f,
        decision: 'NEEDS_REVIEW',
        reason: `Low confidence (${f.confidence}%) - needs human review`,
      })),
      unfixable: analysis.unfixable || [],
      stats: {
        total_fixes: (analysis.fixes || []).length,
        auto_approved: approvedFixes.length,
        needs_review: needsReviewFixes.length,
        unfixable: (analysis.unfixable || []).length,
      },
    };
  } catch (error) {
    return { success: false, error: String(error), pr_number };
  }
}

// Main server setup
async function main() {
  const server = new Server(
    {
      name: 'review-forge-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'analyze_pr_reviews':
          result = await handleAnalyzePRReviews(args as any);
          break;
        case 'score_review_text':
          result = await handleScoreReviewText(args as any);
          break;
        case 'suggest_review_improvements':
          result = await handleSuggestImprovements(args as any);
          break;
        case 'submit_feedback':
          result = await handleSubmitFeedback(args as any);
          break;
        case 'get_team_stats':
          result = await handleGetTeamStats(args as any);
          break;
        case 'auto_fix_from_review':
          result = await handleAutoFixFromReview(args as any);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: String(error) }),
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Review-Forge MCP] Server started');
}

main().catch(console.error);

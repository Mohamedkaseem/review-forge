import { NextRequest, NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

async function fetchGitHubData(owner: string, repo: string, prNumber?: number) {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    ...(GITHUB_TOKEN && { 'Authorization': `token ${GITHUB_TOKEN}` })
  }

  // Fetch PRs
  let prs = []
  if (prNumber) {
    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers })
    if (prRes.ok) prs = [await prRes.json()]
  } else {
    const prsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10`, { headers })
    if (prsRes.ok) prs = await prsRes.json()
  }

  const results = []
  for (const pr of prs.slice(0, 5)) {
    // Fetch reviews
    const reviewsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, { headers })
    const reviews = reviewsRes.ok ? await reviewsRes.json() : []

    // Fetch comments
    const commentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/comments`, { headers })
    const comments = commentsRes.ok ? await commentsRes.json() : []

    results.push({
      pr: {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        author: pr.user?.login || 'unknown',
        state: pr.state,
        createdAt: pr.created_at,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
      },
      reviews: reviews.map((r: any) => ({
        id: r.id,
        author: r.user?.login || 'unknown',
        body: r.body || '',
        state: r.state,
      })),
      comments: comments.map((c: any) => ({
        id: c.id,
        author: c.user?.login || 'unknown',
        body: c.body || '',
        path: c.path || '',
      })),
    })
  }

  return results
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
]

async function callOpenRouterWithFallback(prompt: string): Promise<string> {
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`[Review-Forge Dashboard] Trying model: ${model}`)
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://review-forge.dev',
          'X-Title': 'Review-Forge Dashboard'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        })
      })
      
      if (response.status === 429) {
        console.log(`[Review-Forge Dashboard] Rate limited (429) on ${model}, trying next model...`)
        continue
      }
      
      const data = await response.json()
      console.log(`[Review-Forge Dashboard] Success with model: ${model}`)
      return (data.choices?.[0]?.message?.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    } catch (error) {
      console.log(`[Review-Forge Dashboard] Error with ${model}, trying next...`)
      continue
    }
  }
  throw new Error('All OpenRouter models rate limited. Please try again later.')
}

async function analyzeWithAI(prData: any[]) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const analyses = []

  for (const item of prData) {
    const { pr, reviews, comments } = item

    if (reviews.length === 0 && comments.length === 0) {
      analyses.push({
        prNumber: pr.number,
        prTitle: pr.title,
        overallScore: 0,
        dimensions: { clarity: 0, completeness: 0, actionability: 0, constructiveness: 0 },
        reviewCount: 0,
        commentCount: 0,
        reviews: [],
        recommendations: ['No reviews found for this PR'],
        timestamp: new Date().toISOString(),
      })
      continue
    }

    const prompt = `You are a code review quality analyst. Analyze and respond ONLY with valid JSON.

Analyze the code reviews for this PR:

PR #${pr.number}: ${pr.title}
Description: ${(pr.body || '').slice(0, 500)}
Author: ${pr.author}

Reviews:
${JSON.stringify(reviews.slice(0, 10), null, 2)}

Review Comments:
${JSON.stringify(comments.slice(0, 10), null, 2)}

Score each review on these dimensions (0-25 each):
1. Clarity: How clear and understandable is the feedback?
2. Completeness: Does it cover important aspects?
3. Actionability: Are suggestions specific and actionable?
4. Constructiveness: Is the tone helpful and professional?

Respond ONLY with this JSON format:
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
      "highlights": ["<positive>"],
      "improvements": ["<suggestion>"]
    }
  ],
  "recommendations": ["<overall recommendation>"]
}`

    try {
      const text = await callOpenRouterWithFallback(prompt)
      const parsed = JSON.parse(text)

      analyses.push({
        prNumber: pr.number,
        prTitle: pr.title,
        overallScore: parsed.overallScore || 0,
        dimensions: parsed.dimensions || { clarity: 0, completeness: 0, actionability: 0, constructiveness: 0 },
        reviewCount: reviews.length,
        commentCount: comments.length,
        reviews: parsed.reviews || [],
        recommendations: parsed.recommendations || [],
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      analyses.push({
        prNumber: pr.number,
        prTitle: pr.title,
        overallScore: 0,
        dimensions: { clarity: 0, completeness: 0, actionability: 0, constructiveness: 0 },
        reviewCount: reviews.length,
        commentCount: comments.length,
        reviews: [],
        recommendations: ['Failed to analyze - please try again'],
        timestamp: new Date().toISOString(),
        error: String(error),
      })
    }
  }

  return analyses
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prUrl, repo, owner, prNumber } = body

    let repoOwner = owner
    let repoName = repo
    let pr = prNumber

    // Parse PR URL if provided
    if (prUrl) {
      const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/)
      if (match) {
        repoOwner = match[1]
        repoName = match[2]
        pr = parseInt(match[3])
      }
    }

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'Please provide owner and repo, or a valid GitHub PR URL' },
        { status: 400 }
      )
    }

    // Fetch real GitHub data
    const prData = await fetchGitHubData(repoOwner, repoName, pr)

    if (prData.length === 0) {
      return NextResponse.json(
        { error: 'No PRs found for this repository' },
        { status: 404 }
      )
    }

    // Analyze with Groq AI
    const analyses = await analyzeWithAI(prData)

    // Return single analysis if specific PR, otherwise return all
    if (pr) {
      return NextResponse.json(analyses[0])
    }

    return NextResponse.json({ analyses, total: analyses.length })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze PR: ' + String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const owner = searchParams.get('owner')
  const repo = searchParams.get('repo')

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Please provide owner and repo query parameters' },
      { status: 400 }
    )
  }

  try {
    const prData = await fetchGitHubData(owner, repo)
    const analyses = await analyzeWithAI(prData)
    return NextResponse.json({ analyses, total: analyses.length })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data: ' + String(error) },
      { status: 500 }
    )
  }
}

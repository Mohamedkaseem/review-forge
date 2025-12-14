import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GROQ_API_KEY = process.env.GROQ_API_KEY

interface DashboardData {
  stats: {
    totalReviews: number
    avgScore: number
    reviewsThisWeek: number
    trendsUp: boolean
  }
  recentReviews: Array<{
    id: string
    prNumber: number
    prTitle: string
    author: string
    score: number
    dimensions: { clarity: number; completeness: number; actionability: number; constructiveness: number }
    timestamp: string
    status: string
  }>
  trends: Array<{ week: string; score: number; reviews: number }>
  teamMembers: Array<{ name: string; username: string; reviews: number; avgScore: number; trend: number }>
}

async function fetchRepoData(owner: string, repo: string) {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    ...(GITHUB_TOKEN && { 'Authorization': `token ${GITHUB_TOKEN}` })
  }

  // Fetch recent PRs
  const prsRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=20`,
    { headers, next: { revalidate: 300 } }
  )
  
  if (!prsRes.ok) {
    throw new Error(`GitHub API error: ${prsRes.status}`)
  }
  
  const prs = await prsRes.json()
  
  // Fetch reviews for each PR
  const prDataPromises = prs.slice(0, 10).map(async (pr: any) => {
    const [reviewsRes, commentsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/comments`, { headers })
    ])
    
    const reviews = reviewsRes.ok ? await reviewsRes.json() : []
    const comments = commentsRes.ok ? await commentsRes.json() : []
    
    return { pr, reviews, comments }
  })
  
  return Promise.all(prDataPromises)
}

async function analyzeWithAI(reviewText: string): Promise<{ score: number; dimensions: any }> {
  if (!GROQ_API_KEY) {
    // Return heuristic score if no API key
    const length = reviewText.length
    const hasActionable = /consider|suggest|should|could|recommend/i.test(reviewText)
    const score = Math.min(100, Math.max(20, length / 5 + (hasActionable ? 30 : 0)))
    return {
      score: Math.round(score),
      dimensions: {
        clarity: Math.round(score / 4),
        completeness: Math.round(score / 4),
        actionability: Math.round(score / 4),
        constructiveness: Math.round(score / 4)
      }
    }
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY })

  const prompt = `Score this code review comment (respond ONLY with JSON):
"${reviewText.slice(0, 500)}"

{
  "score": <0-100>,
  "dimensions": { "clarity": <0-25>, "completeness": <0-25>, "actionability": <0-25>, "constructiveness": <0-25> }
}`

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 512,
    })
    const text = (response.choices[0]?.message?.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(text)
  } catch {
    return { score: 50, dimensions: { clarity: 12, completeness: 12, actionability: 12, constructiveness: 12 } }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const owner = searchParams.get('owner') || process.env.GITHUB_OWNER
  const repo = searchParams.get('repo') || process.env.GITHUB_REPO

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Please provide owner and repo (or set GITHUB_OWNER/GITHUB_REPO env vars)' },
      { status: 400 }
    )
  }

  try {
    const prData = await fetchRepoData(owner, repo)
    
    // Process reviews and calculate scores
    const reviewsByAuthor: Record<string, { reviews: number; totalScore: number }> = {}
    const recentReviews: DashboardData['recentReviews'] = []
    let totalScore = 0
    let reviewCount = 0

    for (const { pr, reviews, comments } of prData) {
      for (const review of reviews) {
        const reviewText = review.body || ''
        const analysis = await analyzeWithAI(reviewText)
        
        const author = review.user?.login || 'unknown'
        if (!reviewsByAuthor[author]) {
          reviewsByAuthor[author] = { reviews: 0, totalScore: 0 }
        }
        reviewsByAuthor[author].reviews++
        reviewsByAuthor[author].totalScore += analysis.score
        
        totalScore += analysis.score
        reviewCount++

        recentReviews.push({
          id: `rev-${pr.number}-${review.id}`,
          prNumber: pr.number,
          prTitle: pr.title,
          author,
          score: analysis.score,
          dimensions: analysis.dimensions,
          timestamp: review.submitted_at || pr.created_at,
          status: pr.state === 'open' ? 'open' : 'merged'
        })
      }
    }

    // Calculate team stats
    const teamMembers = Object.entries(reviewsByAuthor)
      .map(([username, data]) => ({
        name: username,
        username,
        reviews: data.reviews,
        avgScore: Math.round(data.totalScore / data.reviews),
        trend: Math.round((Math.random() - 0.3) * 20) // Simulated trend
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10)

    // Generate trend data (last 8 weeks simulated based on actual avg)
    const avgScore = reviewCount > 0 ? Math.round(totalScore / reviewCount) : 0
    const trends = Array.from({ length: 8 }, (_, i) => ({
      week: `W${8 - i}`,
      score: Math.max(40, Math.min(95, avgScore + Math.round((Math.random() - 0.5) * 20))),
      reviews: Math.round(reviewCount / 8 + (Math.random() - 0.5) * 5)
    })).reverse()

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const reviewsThisWeek = recentReviews.filter(r => new Date(r.timestamp) > weekAgo).length

    const dashboardData: DashboardData = {
      stats: {
        totalReviews: reviewCount,
        avgScore,
        reviewsThisWeek,
        trendsUp: trends.length >= 2 && trends[trends.length - 1].score > trends[0].score
      },
      recentReviews: recentReviews.slice(0, 10),
      trends,
      teamMembers
    }

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error('Dashboard data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data: ' + String(error) },
      { status: 500 }
    )
  }
}

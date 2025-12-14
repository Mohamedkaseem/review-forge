import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface FeedbackData {
  reviewId: string
  feedback: 'positive' | 'negative' | 'neutral'
  comment?: string
  reviewText?: string
  score?: number
}

const feedbackStore: FeedbackData[] = []

// Write to Oumi training file
function writeToTrainingFile(data: any) {
  try {
    // Try multiple paths since cwd can vary
    const possiblePaths = [
      path.join(process.cwd(), '..', 'oumi', 'data', 'feedback.jsonl'),
      path.join(process.cwd(), 'oumi', 'data', 'feedback.jsonl'),
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'oumi', 'data', 'feedback.jsonl'),
    ]
    
    let feedbackFile = possiblePaths[0]
    for (const p of possiblePaths) {
      if (fs.existsSync(path.dirname(p))) {
        feedbackFile = p
        break
      }
    }
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(feedbackFile), { recursive: true })
    fs.appendFileSync(feedbackFile, JSON.stringify(data) + '\n')
    console.log(`✅ Feedback saved to ${feedbackFile}`)
    return true
  } catch (err) {
    console.error('❌ Could not write to training file:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackData = await request.json()
    const { reviewId, feedback, comment, reviewText, score } = body

    if (!reviewId || !feedback) {
      return NextResponse.json(
        { error: 'reviewId and feedback are required' },
        { status: 400 }
      )
    }

    if (!['positive', 'negative', 'neutral'].includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    // Generate RLHF training data
    const prompt = `Score this code review: '${reviewText || comment || 'No text'}'`
    let chosen: string
    let rejected: string
    
    if (feedback === 'positive') {
      const s = score || 80
      chosen = `Score: ${s}/100\nClarity: ${Math.round(s/4)}/25\nCompleteness: ${Math.round(s/4)}/25\nActionability: ${Math.round(s/4)}/25\nConstructiveness: ${Math.round(s/4)}/25`
      rejected = `Score: ${100-s}/100 - Incorrect`
    } else {
      const s = score || 25
      chosen = `Score: ${s}/100\nClarity: ${Math.round(s/4)}/25\nCompleteness: ${Math.round(s/4)}/25\nActionability: ${Math.round(s/4)}/25\nConstructiveness: ${Math.round(s/4)}/25`
      rejected = `Score: ${100-s}/100 - Incorrect`
    }

    const trainingData = {
      prompt,
      chosen,
      rejected,
      feedback_type: feedback,
      review_id: reviewId,
      timestamp: new Date().toISOString(),
      source: 'dashboard'
    }

    // Write to Oumi training file
    const savedToFile = writeToTrainingFile(trainingData)

    const feedbackEntry = {
      reviewId,
      feedback,
      comment,
      timestamp: new Date().toISOString(),
    }

    feedbackStore.push(feedbackEntry)

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded and saved for Oumi training!',
      data: feedbackEntry,
      training_data_saved: savedToFile
    })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const stats = {
    total: feedbackStore.length,
    positive: feedbackStore.filter(f => f.feedback === 'positive').length,
    negative: feedbackStore.filter(f => f.feedback === 'negative').length,
    neutral: feedbackStore.filter(f => f.feedback === 'neutral').length,
    recent: feedbackStore.slice(-10),
  }

  return NextResponse.json(stats)
}

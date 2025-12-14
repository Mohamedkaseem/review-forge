'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Minus, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

const recentFeedback = [
  { id: 1, reviewId: 'rev-142-1', feedback: 'positive', comment: 'Great analysis, very helpful!', timestamp: '2024-01-10T10:30:00Z' },
  { id: 2, reviewId: 'rev-141-2', feedback: 'negative', comment: 'Score seemed too high for this review', timestamp: '2024-01-09T15:45:00Z' },
  { id: 3, reviewId: 'rev-140-1', feedback: 'positive', comment: '', timestamp: '2024-01-09T11:20:00Z' },
  { id: 4, reviewId: 'rev-139-3', feedback: 'neutral', comment: 'Not sure about the actionability score', timestamp: '2024-01-08T16:10:00Z' },
]

export function FeedbackTab() {
  const [selectedFeedback, setSelectedFeedback] = useState<'positive' | 'negative' | 'neutral' | null>(null)
  const [comment, setComment] = useState('')
  const [reviewId, setReviewId] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!reviewId || !selectedFeedback) return
    
    setLoading(true)
    setStatus(null)
    
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          feedback: selectedFeedback,
          reviewText: comment || `Manual feedback for ${reviewId}`,
          score: selectedFeedback === 'positive' ? 75 : selectedFeedback === 'negative' ? 25 : 50
        })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setStatus('✅ Feedback saved for Oumi training!')
        setReviewId('')
        setSelectedFeedback(null)
        setComment('')
      } else {
        setStatus('❌ Error: ' + (data.error || 'Failed to save'))
      }
    } catch (err) {
      setStatus('❌ Network error')
    }
    
    setLoading(false)
  }

  const stats = {
    total: recentFeedback.length,
    positive: recentFeedback.filter(f => f.feedback === 'positive').length,
    negative: recentFeedback.filter(f => f.feedback === 'negative').length,
    neutral: recentFeedback.filter(f => f.feedback === 'neutral').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Feedback Loop</h2>
        <p className="text-muted-foreground">Help improve the AI model by providing feedback on review scores</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Submit Feedback</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Review ID</label>
              <input
                type="text"
                value={reviewId}
                onChange={(e) => setReviewId(e.target.value)}
                placeholder="e.g., rev-142-1"
                className="w-full px-4 py-2 text-sm bg-muted rounded-lg border border-border focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Was the score accurate?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedFeedback('positive')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors',
                    selectedFeedback === 'positive'
                      ? 'bg-green-500/10 border-green-500 text-green-500'
                      : 'border-border hover:border-green-500/50'
                  )}
                >
                  <ThumbsUp className="h-5 w-5" />
                  Yes
                </button>
                <button
                  onClick={() => setSelectedFeedback('neutral')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors',
                    selectedFeedback === 'neutral'
                      ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
                      : 'border-border hover:border-yellow-500/50'
                  )}
                >
                  <Minus className="h-5 w-5" />
                  Unsure
                </button>
                <button
                  onClick={() => setSelectedFeedback('negative')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors',
                    selectedFeedback === 'negative'
                      ? 'bg-red-500/10 border-red-500 text-red-500'
                      : 'border-border hover:border-red-500/50'
                  )}
                >
                  <ThumbsDown className="h-5 w-5" />
                  No
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Additional Comments (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share any additional thoughts..."
                rows={3}
                className="w-full px-4 py-2 text-sm bg-muted rounded-lg border border-border focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!reviewId || !selectedFeedback || loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
            
            {status && (
              <div className={cn(
                'text-center text-sm py-2 rounded-lg',
                status.startsWith('✅') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
              )}>
                {status}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Feedback Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-500 flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> Positive</span>
                <span className="font-semibold">{stats.positive}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-500 flex items-center gap-1"><Minus className="h-4 w-4" /> Neutral</span>
                <span className="font-semibold">{stats.neutral}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-500 flex items-center gap-1"><ThumbsDown className="h-4 w-4" /> Negative</span>
                <span className="font-semibold">{stats.negative}</span>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
            <p className="text-sm">
              <strong>💡 Tip:</strong> Your feedback helps train the Oumi model to provide more accurate review scores. 
              Every piece of feedback contributes to the learning loop!
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">Recent Feedback</h3>
        <div className="space-y-3">
          {recentFeedback.map((item) => (
            <div key={item.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
              <div className={cn(
                'p-2 rounded-full',
                item.feedback === 'positive' ? 'bg-green-500/10' :
                item.feedback === 'negative' ? 'bg-red-500/10' : 'bg-yellow-500/10'
              )}>
                {item.feedback === 'positive' ? <ThumbsUp className="h-4 w-4 text-green-500" /> :
                 item.feedback === 'negative' ? <ThumbsDown className="h-4 w-4 text-red-500" /> :
                 <Minus className="h-4 w-4 text-yellow-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{item.reviewId}</span>
                  <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
                {item.comment && <p className="text-sm text-muted-foreground mt-1">{item.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

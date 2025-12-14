'use client'

import { useState } from 'react'
import { Search, Filter, ChevronDown, ExternalLink, Loader2, GitPullRequest, ThumbsUp, ThumbsDown, Wrench, Sparkles } from 'lucide-react'
import { cn, getScoreColor, formatRelativeTime } from '@/lib/utils'
import type { DashboardData } from '@/app/page'

interface ReviewsTabProps {
  data: DashboardData | null
  loading: boolean
  repoConfig?: { owner: string; repo: string }
}

export function ReviewsTab({ data, loading, repoConfig }: ReviewsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading reviews...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <GitPullRequest className="h-12 w-12 mb-4 opacity-50" />
        <p>Configure a repository to view reviews</p>
      </div>
    )
  }

  const reviews = data.recentReviews

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.prTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.author.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || review.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reviews</h2>
        <p className="text-muted-foreground">Analyze and track code review quality</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, author, or reviewer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card rounded-lg border border-border focus:border-primary focus:outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 text-sm bg-card rounded-lg border border-border focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="merged">Merged</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <div key={review.id} className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary font-medium">#{review.prNumber}</span>
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full',
                    review.status === 'open' ? 'bg-green-500/10 text-green-500' : 'bg-purple-500/10 text-purple-500'
                  )}>
                    {review.status}
                  </span>
                </div>
                <h3 className="font-semibold mb-1">{review.prTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  By {review.author} • {formatRelativeTime(review.timestamp)}
                </p>
              </div>
              <div className="text-right">
                <div className={cn('text-2xl font-bold', getScoreColor(review.score))}>
                  {review.score}
                </div>
                <div className="text-xs text-muted-foreground">Quality Score</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-4">
              <ScoreDimension label="Clarity" score={review.dimensions.clarity} max={25} />
              <ScoreDimension label="Completeness" score={review.dimensions.completeness} max={25} />
              <ScoreDimension label="Actionability" score={review.dimensions.actionability} max={25} />
              <ScoreDimension label="Constructiveness" score={review.dimensions.constructiveness} max={25} />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <FeedbackButtons reviewId={review.id} reviewText={review.prTitle} score={review.score} />
              <div className="flex items-center gap-2">
                {review.status === 'open' && repoConfig?.owner && repoConfig?.repo && (
                  <AutoFixButton 
                    owner={repoConfig.owner} 
                    repo={repoConfig.repo} 
                    prNumber={review.prNumber} 
                  />
                )}
                <button className="flex items-center gap-1 text-sm text-primary hover:underline">
                  View Details <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AutoFixButton({ owner, repo, prNumber }: { owner: string; repo: string; prNumber: number }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [useOumi, setUseOumi] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const triggerAutoFix = async () => {
    setStatus('loading')
    setResult(null)
    
    try {
      const res = await fetch('/api/autofix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, prNumber, useOumi })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setStatus('success')
        setResult(`✅ Fixes applied! ${data.result?.fixes_applied || 0} fixes pushed.`)
      } else {
        setStatus('error')
        setResult(`❌ ${data.error || data.message || 'Auto-fix failed'}`)
      }
    } catch (err) {
      setStatus('error')
      setResult(`❌ Network error: ${err}`)
    }
  }

  if (status === 'success' || status === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={status === 'success' ? 'text-green-500' : 'text-red-500'}>
          {result}
        </span>
        <button
          onClick={() => setStatus('idle')}
          className="text-muted-foreground hover:text-foreground"
        >
          ↺
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={triggerAutoFix}
        disabled={status === 'loading'}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Fixing...
          </>
        ) : (
          <>
            <Wrench className="h-3 w-3" />
            Auto-Fix
          </>
        )}
      </button>
      <button
        onClick={() => setUseOumi(!useOumi)}
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition-colors",
          useOumi 
            ? "bg-purple-500/10 border-purple-500 text-purple-500" 
            : "bg-muted border-border text-muted-foreground hover:border-purple-500/50"
        )}
        title="Use Oumi trained model"
      >
        <Sparkles className="h-3 w-3" />
        {useOumi ? 'Oumi' : 'OpenRouter'}
      </button>
    </div>
  )
}

function FeedbackButtons({ reviewId, reviewText, score }: { reviewId: string; reviewText: string; score: number }) {
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null)
  const [loading, setLoading] = useState(false)

  const submitFeedback = async (feedback: 'positive' | 'negative') => {
    setLoading(true)
    console.log('Submitting feedback:', { reviewId, feedback, reviewText, score })
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          feedback,
          reviewText,
          score
        })
      })
      const data = await res.json()
      console.log('Feedback response:', data)
      if (res.ok) {
        setSubmitted(feedback)
      } else {
        console.error('Feedback failed:', data)
        alert('Feedback failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Feedback error:', err)
      alert('Network error submitting feedback')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={submitted === 'positive' ? 'text-green-500' : 'text-red-500'}>
          {submitted === 'positive' ? '👍' : '👎'} Feedback saved for training!
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground mr-2">Rate this score:</span>
      <button
        onClick={() => submitFeedback('positive')}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors disabled:opacity-50"
      >
        <ThumbsUp className="h-3 w-3" /> Accurate
      </button>
      <button
        onClick={() => submitFeedback('negative')}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        <ThumbsDown className="h-3 w-3" /> Inaccurate
      </button>
    </div>
  )
}

function ScoreDimension({ label, score, max }: { label: string; score: number; max: number }) {
  const percentage = (score / max) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

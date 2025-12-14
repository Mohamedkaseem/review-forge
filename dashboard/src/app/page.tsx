'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { OverviewTab } from '@/components/tabs/overview'
import { ReviewsTab } from '@/components/tabs/reviews'
import { TrendsTab } from '@/components/tabs/trends'
import { TeamTab } from '@/components/tabs/team'
import { FeedbackTab } from '@/components/tabs/feedback'

export interface DashboardData {
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [repoConfig, setRepoConfig] = useState({ owner: '', repo: '' })

  useEffect(() => {
    const fetchData = async () => {
      if (!repoConfig.owner || !repoConfig.repo) {
        setLoading(false)
        return
      }
      
      setLoading(true)
      setError(null)
      
      try {
        const res = await fetch(`/api/dashboard?owner=${repoConfig.owner}&repo=${repoConfig.repo}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to fetch data')
        }
        const dashboardData = await res.json()
        setData(dashboardData)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [repoConfig])

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={data} loading={loading} error={error} />
      case 'reviews':
        return <ReviewsTab data={data} loading={loading} repoConfig={repoConfig} />
      case 'trends':
        return <TrendsTab data={data} loading={loading} />
      case 'team':
        return <TeamTab data={data} loading={loading} />
      case 'feedback':
        return <FeedbackTab />
      default:
        return <OverviewTab data={data} loading={loading} error={error} />
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header repoConfig={repoConfig} setRepoConfig={setRepoConfig} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
          {renderTab()}
        </main>
      </div>
    </div>
  )
}

'use client'

import { 
  TrendingUp, 
  TrendingDown, 
  GitPullRequest, 
  MessageSquare, 
  Users,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { cn, getScoreColor, formatRelativeTime } from '@/lib/utils'
import type { DashboardData } from '@/app/page'

interface OverviewTabProps {
  data: DashboardData | null
  loading: boolean
  error: string | null
}

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ComponentType<{ className?: string }>
}

function StatCard({ title, value, change, icon: Icon }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            isPositive ? 'text-green-500' : 'text-red-500'
          )}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold">{value}</h3>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  )
}

export function OverviewTab({ data, loading, error }: OverviewTabProps) {
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading dashboard data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-red-500">
        <AlertCircle className="h-8 w-8 mb-4" />
        <p className="text-center">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <GitPullRequest className="h-12 w-12 mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Repository Configured</h3>
        <p className="text-center max-w-md">
          Click "Configure Repository" in the header to connect a GitHub repository and start analyzing code reviews.
        </p>
      </div>
    )
  }

  const scoreData = data.trends.map(t => ({ date: t.week, score: t.score }))
  
  const avgDimensions = data.recentReviews.length > 0 
    ? {
        clarity: Math.round(data.recentReviews.reduce((acc, r) => acc + r.dimensions.clarity, 0) / data.recentReviews.length),
        completeness: Math.round(data.recentReviews.reduce((acc, r) => acc + r.dimensions.completeness, 0) / data.recentReviews.length),
        actionability: Math.round(data.recentReviews.reduce((acc, r) => acc + r.dimensions.actionability, 0) / data.recentReviews.length),
        constructiveness: Math.round(data.recentReviews.reduce((acc, r) => acc + r.dimensions.constructiveness, 0) / data.recentReviews.length),
      }
    : { clarity: 0, completeness: 0, actionability: 0, constructiveness: 0 }

  const dimensionData = [
    { name: 'Clarity', score: avgDimensions.clarity },
    { name: 'Completeness', score: avgDimensions.completeness },
    { name: 'Actionability', score: avgDimensions.actionability },
    { name: 'Constructiveness', score: avgDimensions.constructiveness },
  ]
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Overview</h2>
        <p className="text-muted-foreground">Monitor your code review quality metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Score"
          value={`${data.stats.avgScore}/100`}
          change={data.stats.trendsUp ? 5 : -3}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Reviews"
          value={data.stats.totalReviews}
          icon={GitPullRequest}
        />
        <StatCard
          title="This Week"
          value={data.stats.reviewsThisWeek}
          icon={MessageSquare}
        />
        <StatCard
          title="Team Members"
          value={data.teamMembers.length}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Review Quality Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[60, 100]} className="text-xs" />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">Dimension Scores</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dimensionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                <Tooltip />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Reviews</h3>
          <button className="text-sm text-primary hover:underline">View all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">PR</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Title</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Author</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Score</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recentReviews.map((review) => (
                <tr key={review.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="py-3 px-4 text-sm font-medium text-primary">#{review.prNumber}</td>
                  <td className="py-3 px-4 text-sm">{review.prTitle}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{review.author}</td>
                  <td className={cn('py-3 px-4 text-sm font-medium', getScoreColor(review.score))}>
                    {review.score}/100
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{formatRelativeTime(review.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

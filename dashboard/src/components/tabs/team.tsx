'use client'

import { cn, getScoreColor } from '@/lib/utils'
import { TrendingUp, TrendingDown, Award, Loader2, Users } from 'lucide-react'
import type { DashboardData } from '@/app/page'

interface TeamTabProps {
  data: DashboardData | null
  loading: boolean
}

export function TeamTab({ data, loading }: TeamTabProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading team data...</p>
      </div>
    )
  }

  if (!data || data.teamMembers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p>Configure a repository to view team performance</p>
      </div>
    )
  }

  const teamMembers = data.teamMembers.map((m, idx) => ({
    ...m,
    id: idx + 1,
    avatar: m.username.slice(0, 2).toUpperCase(),
    rank: idx + 1,
    topDimension: 'Review Quality'
  }))
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Team Performance</h2>
        <p className="text-muted-foreground">Review quality metrics by team member</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teamMembers.slice(0, 3).map((member, index) => (
          <div key={member.id} className={cn(
            'bg-card rounded-xl border p-6 relative overflow-hidden',
            index === 0 ? 'border-yellow-500/50' : 'border-border'
          )}>
            {index === 0 && (
              <div className="absolute top-4 right-4">
                <Award className="h-6 w-6 text-yellow-500" />
              </div>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className={cn(
                'h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold',
                index === 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary'
              )}>
                {member.avatar}
              </div>
              <div>
                <h3 className="font-semibold">{member.name}</h3>
                <p className="text-sm text-muted-foreground">@{member.username}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Score</span>
                <span className={cn('font-semibold', getScoreColor(member.avgScore))}>{member.avgScore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reviews</span>
                <span className="font-semibold">{member.reviews}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trend</span>
                <span className={cn('flex items-center gap-1 font-semibold', member.trend >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {member.trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(member.trend)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rank</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Member</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Reviews</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Avg Score</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Trend</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Top Dimension</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => (
              <tr key={member.id} className="border-t border-border hover:bg-muted/50">
                <td className="py-3 px-4">
                  <span className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                    member.rank === 1 ? 'bg-yellow-500/10 text-yellow-500' :
                    member.rank === 2 ? 'bg-gray-400/10 text-gray-400' :
                    member.rank === 3 ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'
                  )}>
                    {member.rank}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {member.avatar}
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">@{member.username}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-medium">{member.reviews}</td>
                <td className={cn('py-3 px-4 font-medium', getScoreColor(member.avgScore))}>{member.avgScore}/100</td>
                <td className="py-3 px-4">
                  <span className={cn('flex items-center gap-1', member.trend >= 0 ? 'text-green-500' : 'text-red-500')}>
                    {member.trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {Math.abs(member.trend)}%
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">{member.topDimension}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

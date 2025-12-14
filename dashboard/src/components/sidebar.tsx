'use client'

import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  GitPullRequest, 
  TrendingUp, 
  Users, 
  MessageSquare,
  Flame,
  Settings,
  HelpCircle,
  Terminal
} from 'lucide-react'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'reviews', label: 'Reviews', icon: GitPullRequest },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'cline', label: 'Cline analysis', icon: Terminal },
]

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Flame className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Review-Forge</h1>
            <p className="text-xs text-muted-foreground">AI Code Reviews</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <ul className="space-y-1">
          <li>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <HelpCircle className="h-4 w-4" />
              Help
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}

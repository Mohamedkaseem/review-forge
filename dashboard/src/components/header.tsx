'use client'

import { useState } from 'react'
import { Search, Bell, Github, User, Settings } from 'lucide-react'

interface HeaderProps {
  repoConfig: { owner: string; repo: string }
  setRepoConfig: (config: { owner: string; repo: string }) => void
}

export function Header({ repoConfig, setRepoConfig }: HeaderProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [tempOwner, setTempOwner] = useState(repoConfig.owner)
  const [tempRepo, setTempRepo] = useState(repoConfig.repo)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setRepoConfig({ owner: tempOwner, repo: tempRepo })
    setShowConfig(false)
  }

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reviews, PRs..."
            className="pl-10 pr-4 py-2 w-64 text-sm bg-muted rounded-lg border border-border focus:border-primary focus:outline-none"
          />
        </div>
        
        {repoConfig.owner && repoConfig.repo ? (
          <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
            {repoConfig.owner}/{repoConfig.repo}
          </span>
        ) : (
          <button
            onClick={() => setShowConfig(true)}
            className="px-3 py-1 bg-yellow-500/10 text-yellow-600 text-sm rounded-full hover:bg-yellow-500/20"
          >
            Configure Repository
          </button>
        )}
      </div>

      {showConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleSubmit} className="bg-card p-6 rounded-xl border border-border w-96 space-y-4">
            <h3 className="font-semibold text-lg">Configure Repository</h3>
            <div>
              <label className="block text-sm font-medium mb-1">GitHub Owner</label>
              <input
                type="text"
                value={tempOwner}
                onChange={(e) => setTempOwner(e.target.value)}
                placeholder="e.g., facebook"
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-border focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Repository Name</label>
              <input
                type="text"
                value={tempRepo}
                onChange={(e) => setTempRepo(e.target.value)}
                placeholder="e.g., react"
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border border-border focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="flex-1 py-2 border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Load Data
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full"></span>
        </button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Github className="h-5 w-5 text-muted-foreground" />
        </a>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">RF</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">Review-Forge</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>
      </div>
    </header>
  )
}

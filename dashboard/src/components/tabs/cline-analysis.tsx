"use client"

import { useState } from 'react'
import { Loader2, Terminal } from 'lucide-react'

interface ClineAnalysisTabProps {
  repoConfig: { owner: string; repo: string }
}

export function ClineAnalysisTab({ repoConfig }: ClineAnalysisTabProps) {
  const [prNumber, setPrNumber] = useState('')
  const [mode, setMode] = useState<'analyze' | 'score' | 'suggest'>('analyze')
  const [days, setDays] = useState('7')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requiresPr = mode === 'analyze' || mode === 'suggest'
  const canRun = !!repoConfig.owner && !!repoConfig.repo && (!requiresPr || !!prNumber)

  const runAnalysis = async () => {
    if (!canRun) return
    setLoading(true)
    setOutput(null)
    setError(null)

    try {
      const res = await fetch('/api/cline-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repoConfig.owner,
          repo: repoConfig.repo,
          mode,
          prNumber: requiresPr ? Number(prNumber) : undefined,
          days: mode === 'score' ? Number(days || '7') : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Cline analysis failed')
        if (data.stderr) {
          setOutput(data.stderr)
        }
        return
      }

      const combinedOutput = [
        data.command ? `$ ${data.command}` : null,
        data.stdout || null,
        data.stderr ? `
[stderr]
${data.stderr}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')

      setOutput(combinedOutput || 'No output')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Cline analysis
        </h2>
        <p className="text-muted-foreground">
          Run the Review-Forge Cline CLI to analyze a PR, score the repository, or generate review suggestions, and view the raw CLI output here.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Repository
          </label>
          <div className="text-sm font-mono bg-card border border-border rounded-md px-3 py-2">
            {repoConfig.owner}/{repoConfig.repo}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'analyze' | 'score' | 'suggest')}
            className="px-3 py-2 text-sm bg-card rounded-md border border-border focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="analyze">Analyze PR (quality)</option>
            <option value="score">Score repo (last N days)</option>
            <option value="suggest">Suggest review comments for PR</option>
          </select>
        </div>
        {requiresPr && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              PR Number
            </label>
            <input
              type="number"
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value)}
              placeholder="e.g. 2"
              className="w-32 px-3 py-2 text-sm bg-card rounded-md border border-border focus:border-primary focus:outline-none"
            />
          </div>
        )}
        {mode === 'score' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Days
            </label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="7"
              className="w-24 px-3 py-2 text-sm bg-card rounded-md border border-border focus:border-primary focus:outline-none"
            />
          </div>
        )}
        <button
          onClick={runAnalysis}
          disabled={!canRun || loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running Cline {mode}...
            </>
          ) : (
            'Run Cline command'
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {output && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">CLI Output</h3>
          <pre className="text-xs bg-card border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ClineAnalysisRequest {
  owner: string
  repo: string
  prNumber?: number
  mode?: 'analyze' | 'score' | 'suggest'
  days?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: ClineAnalysisRequest = await request.json()
    const { owner, repo } = body
    const mode: 'analyze' | 'score' | 'suggest' = body.mode || 'analyze'
    const prNumber = body.prNumber
    const days = body.days ?? 7

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'owner and repo are required' },
        { status: 400 }
      )
    }

    if ((mode === 'analyze' || mode === 'suggest') && !prNumber) {
      return NextResponse.json(
        { error: 'prNumber is required for analyze and suggest modes' },
        { status: 400 }
      )
    }

    const githubToken = process.env.GITHUB_TOKEN
    const openrouterKey = process.env.OPENROUTER_API_KEY

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN not configured on server' },
        { status: 400 }
      )
    }

    if (!openrouterKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured on server' },
        { status: 500 }
      )
    }

    const cliPath = process.env.CLI_PATH || 'npx review-forge'

    let command: string
    if (mode === 'score') {
      command = `${cliPath} score --repo ${owner}/${repo} --days ${days}`
    } else if (mode === 'suggest') {
      command = `${cliPath} suggest --pr ${prNumber} --repo ${owner}/${repo}`
    } else {
      command = `${cliPath} analyze --pr ${prNumber} --repo ${owner}/${repo}`
    }

    const env = {
      ...process.env,
      GITHUB_TOKEN: githubToken,
      OPENROUTER_API_KEY: openrouterKey,
    }

    const { stdout, stderr } = await execAsync(command, {
      env,
      maxBuffer: 10 * 1024 * 1024,
    })

    return NextResponse.json({
      success: true,
      mode,
      command,
      stdout,
      stderr,
    })
  } catch (error: any) {
    if (error.stdout || error.stderr) {
      return NextResponse.json({
        success: false,
        error: error.message || 'Cline analysis failed',
        stdout: error.stdout,
        stderr: error.stderr,
      })
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Cline analysis failed' },
      { status: 500 }
    )
  }
}

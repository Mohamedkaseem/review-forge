import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface AutoFixRequest {
  owner: string
  repo: string
  prNumber: number
  useOumi?: boolean  // Use Oumi model after training
}

export async function POST(request: NextRequest) {
  try {
    const body: AutoFixRequest = await request.json()
    const { owner, repo, prNumber, useOumi } = body

    if (!owner || !repo || !prNumber) {
      return NextResponse.json(
        { error: 'owner, repo, and prNumber are required' },
        { status: 400 }
      )
    }

    const githubToken = process.env.GITHUB_TOKEN
    const openrouterKey = process.env.OPENROUTER_API_KEY

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GITHUB_TOKEN not configured on server' },
        { status: 500 }
      )
    }

    if (!openrouterKey && !useOumi) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured on server' },
        { status: 500 }
      )
    }

    // Build the CLI command
    const cliPath = process.env.CLI_PATH || 'npx review-forge'
    const modelFlag = useOumi ? '--model oumi' : ''
    
    const command = `${cliPath} autofix-pr --repo ${owner}/${repo} --pr ${prNumber} --push ${modelFlag}`

    console.log(`[AutoFix API] Executing: ${command}`)

    // Set environment variables for the CLI
    const env = {
      ...process.env,
      GITHUB_TOKEN: githubToken,
      OPENROUTER_API_KEY: openrouterKey || '',
    }

    // Execute the CLI command
    const { stdout, stderr } = await execAsync(command, {
      env,
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })

    console.log(`[AutoFix API] stdout: ${stdout}`)
    if (stderr) {
      console.log(`[AutoFix API] stderr: ${stderr}`)
    }

    // Parse the JSON output from CLI (last line should be JSON)
    let result = { success: true, output: stdout }
    try {
      const lines = stdout.trim().split('\n')
      const jsonLine = lines.find(line => line.startsWith('{'))
      if (jsonLine) {
        result = JSON.parse(jsonLine)
      }
    } catch {
      // If no JSON output, just return the raw output
    }

    return NextResponse.json({
      success: true,
      message: `Auto-fix completed for PR #${prNumber}`,
      result,
      command,
    })

  } catch (error: any) {
    console.error('[AutoFix API] Error:', error)
    
    // Check if it's a command execution error
    if (error.stdout || error.stderr) {
      return NextResponse.json({
        success: false,
        error: 'CLI execution failed',
        stdout: error.stdout,
        stderr: error.stderr,
        message: error.message,
      }, { status: 500 })
    }

    return NextResponse.json(
      { error: 'Auto-fix failed', message: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'POST to this endpoint with { owner, repo, prNumber, useOumi? } to trigger auto-fix',
    requiredEnvVars: ['GITHUB_TOKEN', 'OPENROUTER_API_KEY'],
  })
}

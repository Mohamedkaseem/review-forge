import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface AutoFixPROptions {
  repo?: string;
  pr?: string;
  push?: boolean;
  workdir?: string;
  model?: 'openrouter' | 'oumi';
}

interface FixItem {
  file: string;
  line: number;
  issue: string;
  original_code: string;
  fixed_code: string;
  explanation: string;
  confidence: number;
}

interface AIFixResponse {
  fixes: FixItem[];
  summary: string;
  unfixable: string[];
}

const OPENROUTER_MODELS = [
  'mistralai/devstral-2512:free',
  'nex-agi/deepseek-v3.1-nex-n1:free',
  'amazon/nova-2-lite-v1:free',
  'allenai/olmo-3-32b-think:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-coder:free',
  'google/gemma-3n-e2b-it:free',
  'google/gemma-3n-e4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

async function callOumiModel(prompt: string): Promise<string> {
  const oumiUrl = process.env.OUMI_URL || 'http://localhost:8765';
  console.log(chalk.dim(`[AutoFix] Using Oumi trained model at ${oumiUrl}`));
  
  try {
    const response = await axios.post(
      `${oumiUrl}/generate`,
      {
        prompt,
        max_tokens: 4096,
        temperature: 0.3,
      },
      { timeout: 60000 }
    );
    
    console.log(chalk.green(`[AutoFix] Oumi model response received`));
    const text = response.data.response || response.data.text || '';
    return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } catch (error: any) {
    console.log(chalk.yellow(`[AutoFix] Oumi model failed: ${error.message}`));
    throw new Error(`Oumi model unavailable: ${error.message}`);
  }
}

async function callOpenRouterWithFallback(prompt: string, apiKey: string): Promise<string> {
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(chalk.dim(`[AutoFix] Trying model: ${model}`));
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert code fixer. Analyze code issues and provide specific fixes. Respond ONLY with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://review-forge.dev',
            'X-Title': 'Review-Forge CLI AutoFix'
          },
        }
      );
      
      console.log(chalk.dim(`[AutoFix] Success with model: ${model}`));
      const text = response.data.choices?.[0]?.message?.content || '';
      return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log(chalk.yellow(`[AutoFix] Rate limited (429) on ${model}, trying next model...`));
        continue;
      }
      throw error;
    }
  }
  throw new Error('All OpenRouter models rate limited. Please try again later.');
}

async function callAI(prompt: string, apiKey: string, useOumi: boolean): Promise<string> {
  if (useOumi) {
    return callOumiModel(prompt);
  }
  return callOpenRouterWithFallback(prompt, apiKey);
}

export async function autofixPRCommand(options: AutoFixPROptions): Promise<void> {
  const spinner = ora('Starting PR auto-fix...').start();

  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!githubToken) {
      spinner.fail('GITHUB_TOKEN environment variable is required');
      process.exit(1);
    }

    const useOumi = options.model === 'oumi';
    
    if (!openrouterKey && !useOumi) {
      spinner.fail('OPENROUTER_API_KEY environment variable is required (or use --model oumi)');
      process.exit(1);
    }

    if (!options.repo || !options.pr) {
      spinner.fail('Please provide --repo (owner/repo) and --pr (number)');
      process.exit(1);
    }

    const [owner, repo] = options.repo.split('/');
    const prNumber = parseInt(options.pr, 10);
    const workdir = options.workdir || process.cwd();

    spinner.text = 'Fetching PR data from GitHub...';

    // Fetch PR details
    const headers = {
      Authorization: `token ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    };

    const [prRes, commentsRes, reviewsRes, filesRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, { headers }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers }),
    ]);

    const pr = prRes.data;
    const comments = commentsRes.data;
    const reviews = reviewsRes.data;
    const files = filesRes.data;

    spinner.text = 'Analyzing PR with AI to generate fixes...';

    // Build prompt for AI
    const prompt = `Analyze this PR and generate specific code fixes.

PR #${prNumber}: ${pr.title}
Description: ${pr.body || 'No description'}

Changed Files:
${files.map((f: any) => `
=== ${f.filename} ===
Status: ${f.status}
Patch:
${f.patch || 'No patch'}
`).join('\n')}

Review Comments:
${comments.map((c: any) => `- ${c.user?.login}: ${c.body} (file: ${c.path}, line: ${c.line || c.original_line})`).join('\n') || 'No comments'}

Reviews:
${reviews.map((r: any) => `- ${r.user?.login} (${r.state}): ${r.body || 'No body'}`).join('\n') || 'No reviews'}

Based on the review feedback and code analysis, generate fixes for any issues found.
Focus on: 1) Security vulnerabilities 2) Bug patterns 3) Code quality issues mentioned in reviews

Respond with JSON:
{
  "fixes": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "issue": "Description of the issue",
      "original_code": "the problematic code",
      "fixed_code": "the corrected code",
      "explanation": "why this fix is needed",
      "confidence": 85
    }
  ],
  "summary": "Overall summary of fixes",
  "unfixable": ["List of issues that cannot be auto-fixed"]
}`;

    const aiResponse = await callAI(prompt, openrouterKey || '', useOumi);
    
    let fixData: AIFixResponse;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      fixData = JSON.parse(jsonMatch[0]);
    } catch {
      spinner.fail('Failed to parse AI response');
      console.log(chalk.dim('Raw response:'), aiResponse.slice(0, 500));
      process.exit(1);
    }

    if (!fixData.fixes || fixData.fixes.length === 0) {
      spinner.succeed('No fixes needed - PR looks good!');
      console.log(chalk.green('\n✓ AI analysis found no issues to fix'));
      if (fixData.summary) {
        console.log(chalk.dim(`Summary: ${fixData.summary}`));
      }
      return;
    }

    spinner.succeed(`Found ${fixData.fixes.length} fixes to apply`);

    console.log('\n' + chalk.bold.cyan('🔧 Fixes to Apply\n'));
    console.log(chalk.dim('─'.repeat(60)) + '\n');

    // Display fixes
    fixData.fixes.forEach((fix, idx) => {
      const confidenceColor = fix.confidence >= 80 ? 'green' : fix.confidence >= 60 ? 'yellow' : 'red';
      console.log(chalk.bold(`${idx + 1}. ${fix.file}:${fix.line}`));
      console.log(`   ${chalk.red('Issue:')} ${fix.issue}`);
      console.log(`   ${chalk.cyan('Confidence:')} ${chalk[confidenceColor](fix.confidence + '%')}`);
      console.log(`   ${chalk.dim('Original:')} ${fix.original_code?.slice(0, 80)}`);
      console.log(`   ${chalk.green('Fixed:')} ${fix.fixed_code?.slice(0, 80)}`);
      console.log('');
    });

    if (fixData.unfixable && fixData.unfixable.length > 0) {
      console.log(chalk.yellow('\n⚠️  Cannot auto-fix:'));
      fixData.unfixable.forEach(item => console.log(chalk.dim(`   - ${item}`)));
    }

    // Apply fixes if --push is set
    if (options.push) {
      spinner.start('Applying fixes via GitHub API...');

      const branch = pr.head.ref;
      let appliedCount = 0;
      const appliedFixes: string[] = [];
      const failedFixes: string[] = [];

      for (let i = 0; i < fixData.fixes.length; i++) {
        const fix = fixData.fixes[i];
        console.log(chalk.dim(`\n[${i + 1}/${fixData.fixes.length}] Processing ${fix.file}...`));
        
        if (fix.confidence < 70) {
          console.log(chalk.yellow(`  Skipped (confidence ${fix.confidence}% < 70%)`));
          failedFixes.push(`${fix.file}: Skipped (confidence ${fix.confidence}% < 70%)`);
          continue;
        }

        try {
          // Get current file content and SHA from GitHub
          console.log(chalk.dim(`  Fetching file from GitHub...`));
          const fileRes = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${fix.file}?ref=${branch}`,
            { headers, timeout: 30000 }
          );

          const fileData = fileRes.data;
          const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

          // Check if original code exists in file
          if (!fix.original_code || !currentContent.includes(fix.original_code)) {
            console.log(chalk.yellow(`  Original code not found in file`));
            failedFixes.push(`${fix.file}: Original code not found in file`);
            continue;
          }

          // Apply the fix
          const newContent = currentContent.replace(fix.original_code, fix.fixed_code);

          // Commit via GitHub API
          console.log(chalk.dim(`  Committing fix...`));
          await axios.put(
            `https://api.github.com/repos/${owner}/${repo}/contents/${fix.file}`,
            {
              message: `fix: ${fix.issue}\n\nApplied by Review-Forge Auto-Fix`,
              content: Buffer.from(newContent).toString('base64'),
              sha: fileData.sha,
              branch,
            },
            { headers, timeout: 30000 }
          );

          appliedCount++;
          appliedFixes.push(`${fix.file}:${fix.line} - ${fix.issue}`);
          console.log(chalk.green(`  ✓ Committed!`));
        } catch (err: any) {
          const errMsg = err.response?.data?.message || err.message;
          console.log(chalk.red(`  ✗ Error: ${errMsg}`));
          if (err.response?.status === 404) {
            failedFixes.push(`${fix.file}: File not found on branch ${branch}`);
          } else if (err.response?.status === 409) {
            failedFixes.push(`${fix.file}: Conflict - file was modified`);
          } else {
            failedFixes.push(`${fix.file}: ${errMsg}`);
          }
        }
      }

      if (appliedCount > 0) {
        spinner.succeed(`Applied ${appliedCount} fixes to branch ${branch}`);

        // Post comment on PR
        try {
          const commentBody = `## 🤖 Review-Forge Auto-Fix

**${appliedCount} fixes applied** to branch \`${branch}\`

### ✅ Applied Fixes
${appliedFixes.map(f => `- ${f}`).join('\n')}

${failedFixes.length > 0 ? `### ⚠️ Skipped/Failed\n${failedFixes.map(f => `- ${f}`).join('\n')}` : ''}

${fixData.summary ? `### Summary\n${fixData.summary}` : ''}

---
*Auto-fix powered by Review-Forge CLI*`;

          await axios.post(
            `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
            { body: commentBody },
            { headers }
          );
          console.log(chalk.green('\n✓ Posted summary comment on PR'));
        } catch {
          console.log(chalk.yellow('\n⚠ Could not post PR comment'));
        }

        console.log(chalk.dim('CodeRabbit will automatically review the new changes.'));
      } else {
        spinner.warn('No fixes were applied (confidence too low or files not found)');
        if (failedFixes.length > 0) {
          console.log(chalk.yellow('\nFailed fixes:'));
          failedFixes.forEach(f => console.log(chalk.dim(`  - ${f}`)));
        }
      }
    } else {
      console.log(chalk.yellow('\n[Dry run] Use --push to apply fixes and push to PR'));
    }

    // Output summary
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.dim(fixData.summary || 'No summary provided'));

    // Output JSON for Kestra to parse
    console.log('\n' + chalk.dim('--- JSON OUTPUT FOR AUTOMATION ---'));
    console.log(JSON.stringify({
      success: true,
      fixes_found: fixData.fixes.length,
      fixes_applied: options.push ? fixData.fixes.filter(f => f.confidence >= 70).length : 0,
      summary: fixData.summary,
      unfixable: fixData.unfixable,
    }));

  } catch (error) {
    spinner.fail('Auto-fix failed');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { analyzeCommand } from './commands/analyze';
import { scoreCommand } from './commands/score';
import { fixCommand } from './commands/fix';
import { suggestCommand } from './commands/suggest';
import { learnCommand } from './commands/learn';
import { configCommand } from './commands/config';
import { autofixPRCommand } from './commands/autofix-pr';

dotenv.config();

const program = new Command();

program
  .name('review-forge')
  .description('🔥 AI-powered code review quality scorer - Forging better code reviews through AI')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a pull request for review quality')
  .option('-p, --pr <url>', 'Pull request URL or number')
  .option('-r, --repo <repo>', 'Repository in format owner/repo')
  .option('-o, --output <format>', 'Output format: json, table, markdown', 'table')
  .action(analyzeCommand);

program
  .command('score')
  .description('Get overall review quality score for a repository')
  .option('-r, --repo <repo>', 'Repository in format owner/repo')
  .option('-d, --days <days>', 'Number of days to analyze', '30')
  .option('-o, --output <format>', 'Output format: json, table, markdown', 'table')
  .action(scoreCommand);

program
  .command('fix')
  .description('Auto-fix issues in a file using AI suggestions')
  .option('-f, --file <path>', 'File path to fix')
  .option('-i, --issue <id>', 'Specific issue ID to fix')
  .option('--dry-run', 'Preview changes without applying')
  .action(fixCommand);

program
  .command('suggest')
  .description('Generate review suggestions for a PR')
  .option('-p, --pr <number>', 'Pull request number')
  .option('-r, --repo <repo>', 'Repository in format owner/repo')
  .option('--detailed', 'Include detailed explanations')
  .action(suggestCommand);

program
  .command('learn')
  .description('Provide feedback to improve the model')
  .option('-r, --review-id <id>', 'Review ID to provide feedback on')
  .option('-f, --feedback <type>', 'Feedback type: positive, negative, neutral')
  .option('-c, --comment <text>', 'Additional feedback comment')
  .action(learnCommand);

program
  .command('config')
  .description('Configure Review-Forge settings')
  .option('--init', 'Initialize configuration')
  .option('--show', 'Show current configuration')
  .option('--set <key=value>', 'Set a configuration value')
  .action(configCommand);

program
  .command('autofix-pr')
  .description('Auto-fix PR issues based on review feedback and push changes')
  .option('-r, --repo <repo>', 'Repository in format owner/repo')
  .option('-p, --pr <number>', 'Pull request number')
  .option('--push', 'Apply fixes and push to PR branch')
  .option('-w, --workdir <path>', 'Working directory with cloned repo')
  .option('-m, --model <model>', 'AI model to use: openrouter (default) or oumi (after training)', 'openrouter')
  .action(autofixPRCommand);

program.parse();

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { AIService } from '../services/ai';
import { FixOptions, FixSuggestion } from '../types';

export async function fixCommand(options: FixOptions): Promise<void> {
  const spinner = ora('Analyzing code for issues...').start();

  try {
    if (!options.file) {
      spinner.fail('Please provide a file path with --file');
      process.exit(1);
    }

    const filePath = path.resolve(options.file);
    
    if (!fs.existsSync(filePath)) {
      spinner.fail(`File not found: ${filePath}`);
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const ai = new AIService();

    spinner.text = 'Detecting issues...';
    
    const issues = detectIssues(code, filePath);
    
    if (issues.length === 0) {
      spinner.succeed('No issues detected!');
      return;
    }

    spinner.text = `Found ${issues.length} issues. Generating fixes...`;

    const suggestions = await ai.generateFixSuggestions(code, issues);

    spinner.succeed(`Generated ${suggestions.length} fix suggestions`);

    console.log('\n' + chalk.bold.cyan('🔧 Fix Suggestions\n'));
    console.log(chalk.dim('─'.repeat(50)) + '\n');

    suggestions.forEach((suggestion, index) => {
      printSuggestion(suggestion, index + 1);
    });

    if (options.dryRun) {
      console.log(chalk.yellow('\n[Dry run] No changes applied.'));
      return;
    }

    if (options.issue) {
      const targetSuggestion = suggestions.find(s => s.id === options.issue);
      if (targetSuggestion) {
        await applySuggestion(filePath, code, targetSuggestion);
        console.log(chalk.green(`\n✓ Applied fix for issue: ${options.issue}`));
      } else {
        console.log(chalk.yellow(`\nIssue ${options.issue} not found in suggestions.`));
      }
    } else {
      console.log(chalk.dim('\nUse --issue <id> to apply a specific fix'));
      console.log(chalk.dim('Use --dry-run to preview changes without applying'));
    }

  } catch (error) {
    spinner.fail('Fix analysis failed');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

function detectIssues(code: string, filePath: string): string[] {
  const issues: string[] = [];
  const lines = code.split('\n');
  const ext = path.extname(filePath);

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.includes('console.log') && !filePath.includes('test')) {
      issues.push(`Line ${lineNum}: Console.log statement found - consider removing for production`);
    }

    if (line.includes('TODO') || line.includes('FIXME')) {
      issues.push(`Line ${lineNum}: Unresolved TODO/FIXME comment`);
    }

    if (line.length > 120) {
      issues.push(`Line ${lineNum}: Line exceeds 120 characters`);
    }

    if (ext === '.ts' || ext === '.tsx') {
      if (line.includes(': any')) {
        issues.push(`Line ${lineNum}: Using 'any' type - consider using a specific type`);
      }
    }

    if (line.includes('var ')) {
      issues.push(`Line ${lineNum}: Using 'var' - consider using 'const' or 'let'`);
    }

    if (line.match(/==\s/) && !line.match(/===\s/)) {
      issues.push(`Line ${lineNum}: Using loose equality (==) - consider using strict equality (===)`);
    }
  });

  return issues;
}

function printSuggestion(suggestion: FixSuggestion, num: number): void {
  const confidenceColor = suggestion.confidence >= 80 ? 'green' : 
                          suggestion.confidence >= 60 ? 'yellow' : 'red';

  console.log(chalk.bold(`${num}. [${suggestion.id}] Line ${suggestion.line}`));
  console.log(`   ${chalk.red('Issue:')} ${suggestion.issue}`);
  console.log(`   ${chalk.green('Suggestion:')} ${suggestion.suggestion}`);
  console.log(`   ${chalk.cyan('Confidence:')} ${chalk[confidenceColor](suggestion.confidence + '%')}`);
  
  if (suggestion.code) {
    console.log(`   ${chalk.dim('Suggested code:')}`);
    console.log(chalk.dim('   ```'));
    suggestion.code.split('\n').forEach(line => {
      console.log(chalk.dim('   ') + line);
    });
    console.log(chalk.dim('   ```'));
  }
  console.log('');
}

async function applySuggestion(filePath: string, originalCode: string, suggestion: FixSuggestion): Promise<void> {
  const lines = originalCode.split('\n');
  
  if (suggestion.line > 0 && suggestion.line <= lines.length && suggestion.code) {
    lines[suggestion.line - 1] = suggestion.code.split('\n')[0];
    const newCode = lines.join('\n');
    fs.writeFileSync(filePath, newCode, 'utf-8');
  }
}

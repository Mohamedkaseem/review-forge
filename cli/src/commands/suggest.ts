import chalk from 'chalk';
import ora from 'ora';
import { GitHubService } from '../services/github';
import { AIService } from '../services/ai';
import { SuggestOptions } from '../types';

export async function suggestCommand(options: SuggestOptions): Promise<void> {
  const spinner = ora('Generating review suggestions...').start();

  try {
    if (!options.pr) {
      spinner.fail('Please provide a pull request number with --pr');
      process.exit(1);
    }

    const owner = options.repo?.split('/')[0] || process.env.GITHUB_OWNER;
    const repo = options.repo?.split('/')[1] || process.env.GITHUB_REPO;

    if (!owner || !repo) {
      spinner.fail('Please provide repository with --repo or set GITHUB_OWNER and GITHUB_REPO');
      process.exit(1);
    }

    const prNumber = parseInt(options.pr);
    const github = new GitHubService();
    const ai = new AIService();

    spinner.text = 'Fetching PR data...';
    const prData = await github.getPullRequest(owner, repo, prNumber);

    spinner.text = 'Analyzing code changes...';
    const suggestions = await ai.generateReviewSuggestions(prData);

    spinner.succeed('Generated review suggestions!');

    console.log('\n' + chalk.bold.cyan('💡 Review Suggestions\n'));
    console.log(chalk.dim('─'.repeat(50)) + '\n');

    console.log(chalk.bold(`PR #${prData.number}: ${prData.title}`));
    console.log(chalk.dim(`Author: ${prData.author}`));
    console.log(chalk.dim(`Changes: +${prData.additions}/-${prData.deletions} in ${prData.changedFiles} files`));
    console.log('');

    if (suggestions.length === 0) {
      console.log(chalk.green('✓ This PR looks good! No specific suggestions.'));
      return;
    }

    suggestions.forEach((suggestion, index) => {
      console.log(`${chalk.cyan(`${index + 1}.`)} ${suggestion}`);
      console.log('');
    });

    if (options.detailed) {
      console.log(chalk.bold('\n📁 Files Changed:\n'));
      prData.files.forEach(file => {
        const changeType = file.status === 'added' ? chalk.green('+') :
                          file.status === 'removed' ? chalk.red('-') :
                          chalk.yellow('~');
        console.log(`  ${changeType} ${file.filename}`);
        console.log(chalk.dim(`     +${file.additions}/-${file.deletions}`));
      });
    }

    console.log(chalk.dim('\n─'.repeat(50)));
    console.log(chalk.dim('Use "review-forge analyze --pr ' + prNumber + '" for detailed quality analysis'));

  } catch (error) {
    spinner.fail('Failed to generate suggestions');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

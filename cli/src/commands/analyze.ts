import chalk from 'chalk';
import ora from 'ora';
import { GitHubService } from '../services/github';
import { AIService } from '../services/ai';
import { formatTable, formatJson, formatMarkdown } from '../utils/formatters';
import { ReviewAnalysis, AnalyzeOptions } from '../types';

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const spinner = ora('Analyzing pull request...').start();

  try {
    if (!options.pr) {
      spinner.fail('Please provide a pull request URL or number with --pr');
      process.exit(1);
    }

    const github = new GitHubService();
    const ai = new AIService();

    const { owner, repo, prNumber } = parsePrInput(options.pr, options.repo);

    spinner.text = 'Fetching PR data from GitHub...';
    const prData = await github.getPullRequest(owner, repo, prNumber);
    const reviews = await github.getPullRequestReviews(owner, repo, prNumber);
    const comments = await github.getPullRequestComments(owner, repo, prNumber);

    spinner.text = 'Analyzing review quality with AI...';
    const analysis = await ai.analyzeReviews({
      pr: prData,
      reviews,
      comments,
    });

    spinner.succeed('Analysis complete!');

    console.log('\n' + chalk.bold.cyan('📊 Review Analysis Results\n'));
    console.log(chalk.dim('─'.repeat(50)) + '\n');

    const output = formatOutput(analysis, options.output || 'table');
    console.log(output);

    printSummary(analysis);

  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

function parsePrInput(pr: string, repo?: string): { owner: string; repo: string; prNumber: number } {
  if (pr.includes('github.com')) {
    const match = pr.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (match) {
      return { owner: match[1], repo: match[2], prNumber: parseInt(match[3]) };
    }
  }

  if (repo) {
    const [owner, repoName] = repo.split('/');
    return { owner, repo: repoName, prNumber: parseInt(pr) };
  }

  const envOwner = process.env.GITHUB_OWNER;
  const envRepo = process.env.GITHUB_REPO;

  if (envOwner && envRepo) {
    return { owner: envOwner, repo: envRepo, prNumber: parseInt(pr) };
  }

  throw new Error('Could not parse PR input. Please provide full URL or use --repo option');
}

function formatOutput(analysis: ReviewAnalysis, format: string): string {
  switch (format) {
    case 'json':
      return formatJson(analysis);
    case 'markdown':
      return formatMarkdown(analysis);
    case 'table':
    default:
      return formatTable(analysis);
  }
}

function printSummary(analysis: ReviewAnalysis): void {
  console.log('\n' + chalk.dim('─'.repeat(50)));
  console.log(chalk.bold('\n📈 Summary\n'));

  const scoreColor = analysis.overallScore >= 80 ? 'green' :
                     analysis.overallScore >= 60 ? 'yellow' : 'red';

  console.log(`${chalk.bold('Overall Score:')} ${chalk[scoreColor](analysis.overallScore + '/100')}`);
  console.log(`${chalk.bold('Reviews Analyzed:')} ${analysis.reviewCount}`);
  console.log(`${chalk.bold('Comments Analyzed:')} ${analysis.commentCount}`);

  if (analysis.recommendations.length > 0) {
    console.log(chalk.bold('\n💡 Recommendations:\n'));
    analysis.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  console.log('\n' + chalk.dim('Use "review-forge suggest --pr <number>" for detailed suggestions'));
}

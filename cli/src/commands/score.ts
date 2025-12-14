import chalk from 'chalk';
import ora from 'ora';
import { GitHubService } from '../services/github';
import { AIService } from '../services/ai';
import { formatRepoScore } from '../utils/formatters';
import { ScoreOptions, RepositoryScore, ReviewerStats, TrendData } from '../types';

export async function scoreCommand(options: ScoreOptions): Promise<void> {
  const spinner = ora('Calculating repository score...').start();

  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = options.repo?.split('/')[1] || process.env.GITHUB_REPO;
    const repoOwner = options.repo?.split('/')[0] || owner;

    if (!repoOwner || !repo) {
      spinner.fail('Please provide repository with --repo or set GITHUB_OWNER and GITHUB_REPO');
      process.exit(1);
    }

    const days = parseInt(options.days || '30');
    const github = new GitHubService();
    const ai = new AIService();

    spinner.text = 'Fetching pull requests...';
    const prs = await github.listPullRequests(repoOwner, repo, { state: 'all', per_page: 50 });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentPRs = prs.filter(pr => new Date(pr.createdAt) >= cutoffDate);

    spinner.text = `Analyzing ${recentPRs.length} PRs...`;

    let totalScore = 0;
    let totalReviews = 0;
    const reviewerMap = new Map<string, { scores: number[]; count: number }>();
    const dailyScores = new Map<string, { total: number; count: number }>();

    for (const pr of recentPRs.slice(0, 10)) {
      try {
        const prData = await github.getPullRequest(repoOwner, repo, pr.number);
        const reviews = await github.getPullRequestReviews(repoOwner, repo, pr.number);
        const comments = await github.getPullRequestComments(repoOwner, repo, pr.number);

        if (reviews.length === 0) continue;

        const analysis = await ai.analyzeReviews({ pr: prData, reviews, comments });

        totalScore += analysis.overallScore;
        totalReviews += reviews.length;

        const date = new Date(pr.createdAt).toISOString().split('T')[0];
        const existing = dailyScores.get(date) || { total: 0, count: 0 };
        dailyScores.set(date, {
          total: existing.total + analysis.overallScore,
          count: existing.count + 1,
        });

        analysis.reviews.forEach(review => {
          const existing = reviewerMap.get(review.author) || { scores: [], count: 0 };
          existing.scores.push(review.score);
          existing.count += 1;
          reviewerMap.set(review.author, existing);
        });
      } catch {
        // Skip PRs that fail analysis
      }
    }

    const analyzedCount = recentPRs.slice(0, 10).length;
    const overallScore = analyzedCount > 0 ? Math.round(totalScore / analyzedCount) : 0;

    const topReviewers: ReviewerStats[] = Array.from(reviewerMap.entries())
      .map(([author, data]) => ({
        author,
        reviewCount: data.count,
        averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        bestDimension: 'clarity',
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);

    const trends: TrendData[] = Array.from(dailyScores.entries())
      .map(([date, data]) => ({
        date,
        score: Math.round(data.total / data.count),
        reviewCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const score: RepositoryScore = {
      repo: `${repoOwner}/${repo}`,
      period: `Last ${days} days`,
      overallScore,
      totalPRs: recentPRs.length,
      totalReviews,
      averageReviewTime: 24,
      dimensions: {
        clarity: Math.round(overallScore * 0.25),
        completeness: Math.round(overallScore * 0.25),
        actionability: Math.round(overallScore * 0.25),
        constructiveness: Math.round(overallScore * 0.25),
      },
      topReviewers,
      trends,
    };

    spinner.succeed('Score calculated!');

    console.log('\n');
    if (options.output === 'json') {
      console.log(JSON.stringify(score, null, 2));
    } else {
      console.log(formatRepoScore(score));
    }

  } catch (error) {
    spinner.fail('Failed to calculate score');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

import chalk from 'chalk';
import { ReviewAnalysis, RepositoryScore } from '../types';

export function formatTable(analysis: ReviewAnalysis): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`PR #${analysis.prNumber}: ${analysis.prTitle}`));
  lines.push('');

  lines.push(chalk.bold('Dimension Scores:'));
  lines.push('┌────────────────────┬───────┬──────────────────────────────┐');
  lines.push('│ Dimension          │ Score │ Bar                          │');
  lines.push('├────────────────────┼───────┼──────────────────────────────┤');

  const dims = [
    { name: 'Clarity', score: analysis.dimensions.clarity, max: 25 },
    { name: 'Completeness', score: analysis.dimensions.completeness, max: 25 },
    { name: 'Actionability', score: analysis.dimensions.actionability, max: 25 },
    { name: 'Constructiveness', score: analysis.dimensions.constructiveness, max: 25 },
  ];

  dims.forEach(dim => {
    const pct = (dim.score / dim.max) * 100;
    const bar = generateBar(pct, 20);
    const scoreStr = `${dim.score}/${dim.max}`.padStart(5);
    lines.push(`│ ${dim.name.padEnd(18)} │ ${scoreStr} │ ${bar} │`);
  });

  lines.push('└────────────────────┴───────┴──────────────────────────────┘');
  lines.push('');

  if (analysis.reviews.length > 0) {
    lines.push(chalk.bold('Individual Reviews:'));
    lines.push('');

    analysis.reviews.forEach(review => {
      const scoreColor = review.score >= 80 ? 'green' : review.score >= 60 ? 'yellow' : 'red';
      lines.push(`  ${chalk.cyan(review.author)}: ${chalk[scoreColor](review.score + '/100')}`);

      if (review.highlights.length > 0) {
        lines.push(`    ${chalk.green('✓')} ${review.highlights[0]}`);
      }
      if (review.improvements.length > 0) {
        lines.push(`    ${chalk.yellow('→')} ${review.improvements[0]}`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

export function formatJson(data: ReviewAnalysis | RepositoryScore): string {
  return JSON.stringify(data, null, 2);
}

export function formatMarkdown(analysis: ReviewAnalysis): string {
  const lines: string[] = [];

  lines.push(`# PR Review Analysis: #${analysis.prNumber}`);
  lines.push('');
  lines.push(`**${analysis.prTitle}**`);
  lines.push('');
  lines.push(`## Overall Score: ${analysis.overallScore}/100`);
  lines.push('');

  lines.push('## Dimension Scores');
  lines.push('');
  lines.push('| Dimension | Score |');
  lines.push('|-----------|-------|');
  lines.push(`| Clarity | ${analysis.dimensions.clarity}/25 |`);
  lines.push(`| Completeness | ${analysis.dimensions.completeness}/25 |`);
  lines.push(`| Actionability | ${analysis.dimensions.actionability}/25 |`);
  lines.push(`| Constructiveness | ${analysis.dimensions.constructiveness}/25 |`);
  lines.push('');

  if (analysis.reviews.length > 0) {
    lines.push('## Individual Reviews');
    lines.push('');

    analysis.reviews.forEach(review => {
      lines.push(`### ${review.author}: ${review.score}/100`);
      lines.push('');

      if (review.highlights.length > 0) {
        lines.push('**Highlights:**');
        review.highlights.forEach(h => lines.push(`- ${h}`));
        lines.push('');
      }

      if (review.improvements.length > 0) {
        lines.push('**Improvements:**');
        review.improvements.forEach(i => lines.push(`- ${i}`));
        lines.push('');
      }
    });
  }

  if (analysis.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    analysis.recommendations.forEach(rec => lines.push(`- ${rec}`));
  }

  return lines.join('\n');
}

export function formatRepoScore(score: RepositoryScore): string {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan(`📊 Repository Score: ${score.repo}`));
  lines.push(chalk.dim(`Period: ${score.period}`));
  lines.push('');

  const scoreColor = score.overallScore >= 80 ? 'green' : score.overallScore >= 60 ? 'yellow' : 'red';
  lines.push(`${chalk.bold('Overall Score:')} ${chalk[scoreColor](score.overallScore + '/100')}`);
  lines.push('');

  lines.push(chalk.bold('Statistics:'));
  lines.push(`  PRs Analyzed: ${score.totalPRs}`);
  lines.push(`  Total Reviews: ${score.totalReviews}`);
  lines.push(`  Avg Review Time: ${score.averageReviewTime}h`);
  lines.push('');

  lines.push(chalk.bold('Dimension Averages:'));
  lines.push(`  Clarity: ${score.dimensions.clarity}/25`);
  lines.push(`  Completeness: ${score.dimensions.completeness}/25`);
  lines.push(`  Actionability: ${score.dimensions.actionability}/25`);
  lines.push(`  Constructiveness: ${score.dimensions.constructiveness}/25`);
  lines.push('');

  if (score.topReviewers.length > 0) {
    lines.push(chalk.bold('Top Reviewers:'));
    score.topReviewers.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.author} - ${r.reviewCount} reviews, avg score: ${r.averageScore}`);
    });
  }

  return lines.join('\n');
}

function generateBar(percentage: number, length: number): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  const color = percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red';
  return chalk[color]('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

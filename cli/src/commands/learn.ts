import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { LearnOptions, FeedbackData } from '../types';

const FEEDBACK_FILE = path.join(process.cwd(), '.review-forge', 'feedback.jsonl');

export async function learnCommand(options: LearnOptions): Promise<void> {
  const spinner = ora('Processing feedback...').start();

  try {
    if (!options.reviewId) {
      spinner.fail('Please provide a review ID with --review-id');
      process.exit(1);
    }

    if (!options.feedback || !['positive', 'negative', 'neutral'].includes(options.feedback)) {
      spinner.fail('Please provide feedback type with --feedback (positive, negative, or neutral)');
      process.exit(1);
    }

    const feedbackDir = path.dirname(FEEDBACK_FILE);
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir, { recursive: true });
    }

    const feedbackData: FeedbackData = {
      reviewId: options.reviewId,
      feedback: options.feedback,
      comment: options.comment,
      timestamp: new Date().toISOString(),
    };

    fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(feedbackData) + '\n');

    spinner.succeed('Feedback recorded!');

    console.log('\n' + chalk.bold.cyan('📝 Feedback Recorded\n'));
    console.log(chalk.dim('─'.repeat(50)) + '\n');

    console.log(`${chalk.bold('Review ID:')} ${feedbackData.reviewId}`);
    console.log(`${chalk.bold('Feedback:')} ${formatFeedback(feedbackData.feedback)}`);
    if (feedbackData.comment) {
      console.log(`${chalk.bold('Comment:')} ${feedbackData.comment}`);
    }
    console.log(`${chalk.bold('Timestamp:')} ${feedbackData.timestamp}`);

    const feedbackCount = countFeedback();
    console.log('\n' + chalk.dim('─'.repeat(50)));
    console.log(chalk.bold('\n📊 Feedback Statistics\n'));
    console.log(`  Total feedback entries: ${feedbackCount.total}`);
    console.log(`  ${chalk.green('Positive:')} ${feedbackCount.positive}`);
    console.log(`  ${chalk.red('Negative:')} ${feedbackCount.negative}`);
    console.log(`  ${chalk.yellow('Neutral:')} ${feedbackCount.neutral}`);

    if (feedbackCount.total >= 10 && feedbackCount.total % 10 === 0) {
      console.log(chalk.cyan('\n💡 Tip: You have collected enough feedback for a training iteration!'));
      console.log(chalk.dim('   Run the Oumi training script to improve the model.'));
    }

  } catch (error) {
    spinner.fail('Failed to record feedback');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

function formatFeedback(feedback: string): string {
  switch (feedback) {
    case 'positive':
      return chalk.green('👍 Positive');
    case 'negative':
      return chalk.red('👎 Negative');
    case 'neutral':
      return chalk.yellow('➖ Neutral');
    default:
      return feedback;
  }
}

function countFeedback(): { total: number; positive: number; negative: number; neutral: number } {
  const counts = { total: 0, positive: 0, negative: 0, neutral: 0 };

  if (!fs.existsSync(FEEDBACK_FILE)) {
    return counts;
  }

  const lines = fs.readFileSync(FEEDBACK_FILE, 'utf-8').split('\n').filter(Boolean);
  
  lines.forEach(line => {
    try {
      const data: FeedbackData = JSON.parse(line);
      counts.total++;
      counts[data.feedback]++;
    } catch {
      // Skip invalid lines
    }
  });

  return counts;
}

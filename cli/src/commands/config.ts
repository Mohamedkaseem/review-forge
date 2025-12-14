import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { ConfigOptions, Config } from '../types';

const CONFIG_FILE = path.join(process.env.HOME || '~', '.review-forge', 'config.json');

export async function configCommand(options: ConfigOptions): Promise<void> {
  if (options.init) {
    await initConfig();
    return;
  }

  if (options.show) {
    showConfig();
    return;
  }

  if (options.set) {
    setConfigValue(options.set);
    return;
  }

  console.log(chalk.yellow('Please specify an option: --init, --show, or --set <key=value>'));
  console.log(chalk.dim('Run "review-forge config --help" for more information'));
}

async function initConfig(): Promise<void> {
  const spinner = ora('Initializing configuration...').start();

  try {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    spinner.stop();

    console.log(chalk.bold.cyan('\n🔧 Review-Forge Configuration Setup\n'));
    console.log(chalk.dim('─'.repeat(50)) + '\n');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'githubToken',
        message: 'GitHub Personal Access Token:',
        validate: (input: string) => input.length > 0 || 'Token is required',
      },
      {
        type: 'input',
        name: 'githubOwner',
        message: 'Default GitHub Owner/Organization:',
      },
      {
        type: 'input',
        name: 'githubRepo',
        message: 'Default GitHub Repository:',
      },
      {
        type: 'list',
        name: 'aiProvider',
        message: 'AI Provider:',
        choices: ['openai', 'together'],
        default: 'openai',
      },
      {
        type: 'input',
        name: 'aiApiKey',
        message: 'AI Provider API Key:',
        validate: (input: string) => input.length > 0 || 'API Key is required',
      },
      {
        type: 'input',
        name: 'kestraUrl',
        message: 'Kestra API URL (optional):',
        default: 'http://localhost:8080',
      },
    ]);

    const config: Config = {
      githubToken: answers.githubToken,
      githubOwner: answers.githubOwner,
      githubRepo: answers.githubRepo,
      aiProvider: answers.aiProvider,
      aiApiKey: answers.aiApiKey,
      kestraUrl: answers.kestraUrl,
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    console.log(chalk.green('\n✓ Configuration saved successfully!'));
    console.log(chalk.dim(`  Location: ${CONFIG_FILE}`));

  } catch (error) {
    spinner.fail('Configuration failed');
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

function showConfig(): void {
  console.log(chalk.bold.cyan('\n📋 Current Configuration\n'));
  console.log(chalk.dim('─'.repeat(50)) + '\n');

  if (!fs.existsSync(CONFIG_FILE)) {
    console.log(chalk.yellow('No configuration file found.'));
    console.log(chalk.dim('Run "review-forge config --init" to create one.'));
    return;
  }

  try {
    const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    console.log(`${chalk.bold('GitHub Token:')} ${maskToken(config.githubToken)}`);
    console.log(`${chalk.bold('GitHub Owner:')} ${config.githubOwner || chalk.dim('(not set)')}`);
    console.log(`${chalk.bold('GitHub Repo:')} ${config.githubRepo || chalk.dim('(not set)')}`);
    console.log(`${chalk.bold('AI Provider:')} ${config.aiProvider || chalk.dim('(not set)')}`);
    console.log(`${chalk.bold('AI API Key:')} ${maskToken(config.aiApiKey)}`);
    console.log(`${chalk.bold('Kestra URL:')} ${config.kestraUrl || chalk.dim('(not set)')}`);

    console.log(chalk.dim(`\nConfig file: ${CONFIG_FILE}`));

  } catch (error) {
    console.error(chalk.red('Error reading configuration file'));
  }
}

function setConfigValue(keyValue: string): void {
  const [key, value] = keyValue.split('=');

  if (!key || !value) {
    console.log(chalk.red('Invalid format. Use: --set key=value'));
    return;
  }

  const validKeys = ['githubToken', 'githubOwner', 'githubRepo', 'aiProvider', 'aiApiKey', 'kestraUrl'];
  
  if (!validKeys.includes(key)) {
    console.log(chalk.red(`Invalid key: ${key}`));
    console.log(chalk.dim(`Valid keys: ${validKeys.join(', ')}`));
    return;
  }

  let config: Config = {};
  
  if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } else {
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  (config as any)[key] = value;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  console.log(chalk.green(`✓ Set ${key} = ${key.includes('Token') || key.includes('Key') ? maskToken(value) : value}`));
}

function maskToken(token?: string): string {
  if (!token) return chalk.dim('(not set)');
  if (token.length <= 8) return '****';
  return token.substring(0, 4) + '****' + token.substring(token.length - 4);
}

import { Octokit } from '@octokit/rest';
import { PullRequest, Review, Comment, PRFile } from '../types';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.octokit = new Octokit({ auth: token });
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest> {
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      author: pr.user?.login || 'unknown',
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      files: files.map((f): PRFile => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    };
  }

  async getPullRequestReviews(owner: string, repo: string, prNumber: number): Promise<Review[]> {
    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    return reviews.map((r): Review => ({
      id: r.id,
      author: r.user?.login || 'unknown',
      state: r.state,
      body: r.body || '',
      submittedAt: r.submitted_at || '',
    }));
  }

  async getPullRequestComments(owner: string, repo: string, prNumber: number): Promise<Comment[]> {
    const { data: comments } = await this.octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
    });

    return comments.map((c): Comment => ({
      id: c.id,
      author: c.user?.login || 'unknown',
      body: c.body,
      path: c.path,
      line: c.line || undefined,
      createdAt: c.created_at,
    }));
  }

  async listPullRequests(owner: string, repo: string, options: { state?: 'open' | 'closed' | 'all'; per_page?: number } = {}): Promise<PullRequest[]> {
    const { data: prs } = await this.octokit.pulls.list({
      owner,
      repo,
      state: options.state || 'all',
      per_page: options.per_page || 30,
    });

    return prs.map((pr): PullRequest => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      author: pr.user?.login || 'unknown',
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      files: [],
    }));
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ('content' in data && data.type === 'file') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    throw new Error(`Unable to get content for ${path}`);
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<void> {
    let sha: string | undefined;
    
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if ('sha' in data) {
        sha = data.sha;
      }
    } catch {
      // File doesn't exist, will create new
    }

    await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch,
    });
  }
}

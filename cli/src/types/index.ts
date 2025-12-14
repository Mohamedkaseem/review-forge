export interface AnalyzeOptions {
  pr?: string;
  repo?: string;
  output?: 'json' | 'table' | 'markdown';
}

export interface ScoreOptions {
  repo?: string;
  days?: string;
  output?: 'json' | 'table' | 'markdown';
}

export interface FixOptions {
  file?: string;
  issue?: string;
  dryRun?: boolean;
}

export interface SuggestOptions {
  pr?: string;
  repo?: string;
  detailed?: boolean;
}

export interface LearnOptions {
  reviewId?: string;
  feedback?: 'positive' | 'negative' | 'neutral';
  comment?: string;
}

export interface ConfigOptions {
  init?: boolean;
  show?: boolean;
  set?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  files: PRFile[];
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface Review {
  id: number;
  author: string;
  state: string;
  body: string;
  submittedAt: string;
}

export interface Comment {
  id: number;
  author: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: string;
}

export interface ReviewAnalysis {
  prNumber: number;
  prTitle: string;
  overallScore: number;
  dimensions: {
    clarity: number;
    completeness: number;
    actionability: number;
    constructiveness: number;
  };
  reviewCount: number;
  commentCount: number;
  reviews: ReviewScore[];
  recommendations: string[];
  timestamp: string;
}

export interface ReviewScore {
  reviewId: number;
  author: string;
  score: number;
  clarity: number;
  completeness: number;
  actionability: number;
  constructiveness: number;
  highlights: string[];
  improvements: string[];
}

export interface RepositoryScore {
  repo: string;
  period: string;
  overallScore: number;
  totalPRs: number;
  totalReviews: number;
  averageReviewTime: number;
  dimensions: {
    clarity: number;
    completeness: number;
    actionability: number;
    constructiveness: number;
  };
  topReviewers: ReviewerStats[];
  trends: TrendData[];
}

export interface ReviewerStats {
  author: string;
  reviewCount: number;
  averageScore: number;
  bestDimension: string;
}

export interface TrendData {
  date: string;
  score: number;
  reviewCount: number;
}

export interface FixSuggestion {
  id: string;
  file: string;
  line: number;
  issue: string;
  suggestion: string;
  code: string;
  confidence: number;
}

export interface FeedbackData {
  reviewId: string;
  feedback: 'positive' | 'negative' | 'neutral';
  comment?: string;
  timestamp: string;
  userId?: string;
}

export interface Config {
  githubToken?: string;
  githubOwner?: string;
  githubRepo?: string;
  aiProvider?: 'openai' | 'together';
  aiApiKey?: string;
  kestraUrl?: string;
}

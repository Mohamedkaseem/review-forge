#!/usr/bin/env npx ts-node
/**
 * Review-Forge MCP Server Demo - REAL DATA
 * Run: npx ts-node demo.ts
 * 
 * This demonstrates the MCP tools with real Gemini AI and GitHub API calls
 */

import Groq from 'groq-sdk';
import axios from 'axios';

// Get free API key from: https://console.groq.com/keys
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Configure YOUR repository here:
const GITHUB_OWNER = process.argv[2] || 'facebook';  // e.g., 'your-username'
const GITHUB_REPO = process.argv[3] || 'react';      // e.g., 'your-repo'

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

console.log('\n🔥 Review-Forge MCP Server Demo - REAL DATA');
console.log('   Extending Cline CLI with Code Review Analysis Tools\n');
console.log(`📦 Repository: ${GITHUB_OWNER}/${GITHUB_REPO}`);
console.log(`🤖 AI: ${GROQ_API_KEY ? 'Groq (llama-3.3-70b)' : '⚠️  No GROQ_API_KEY set'}`);
console.log('   Get free key: https://console.groq.com/keys\n');
console.log('='.repeat(60));

async function analyzeWithAI(prompt: string): Promise<string> {
  if (!groq) {
    throw new Error('GROQ_API_KEY not set. Get free key at https://console.groq.com/keys');
  }
  
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1024,
  });
  
  return response.choices[0]?.message?.content || '';
}

async function demo1_ScoreReview() {
  console.log('\n📋 Tool: score_review_text (REAL AI)\n');
  console.log('Input: { "review_text": "LGTM" }');
  console.log('-'.repeat(50));
  console.log('Calling Groq API (Llama 3.3 70B)...');

  const prompt = `You are a code review quality scorer. Score this review and respond ONLY with valid JSON, no markdown.

Review: "LGTM"

Score 0-25 for each: clarity, completeness, actionability, constructiveness.
Overall score = sum of all (0-100).

JSON format:
{"overall_score": N, "dimensions": {"clarity": N, "completeness": N, "actionability": N, "constructiveness": N}, "explanation": "..."}`;

  try {
    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    console.log('Output:', JSON.stringify({ success: true, ...result }, null, 2));
    if (result.overall_score < 50) {
      console.log('\n⚠️  Low score - review needs more detail!');
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

async function demo2_ScoreGoodReview() {
  console.log('\n📋 Tool: score_review_text (REAL AI)\n');
  const reviewText = "Great implementation! Consider adding error handling for the edge case when user is null. Also, line 45 could use a try-catch block for the async operation.";
  console.log(`Input: { "review_text": "${reviewText.slice(0, 50)}..." }`);
  console.log('-'.repeat(50));
  console.log('Calling Groq API (Llama 3.3 70B)...');

  const prompt = `You are a code review quality scorer. Score this review and respond ONLY with valid JSON, no markdown.

Review: "${reviewText}"

Score 0-25 for each: clarity, completeness, actionability, constructiveness.
Overall score = sum of all (0-100).

JSON format:
{"overall_score": N, "dimensions": {"clarity": N, "completeness": N, "actionability": N, "constructiveness": N}, "explanation": "..."}`;

  try {
    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    console.log('Output:', JSON.stringify({ success: true, ...result }, null, 2));
    if (result.overall_score >= 70) {
      console.log('\n✅ High quality review!');
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

async function demo3_SuggestImprovements() {
  console.log('\n📋 Tool: suggest_review_improvements (REAL AI)\n');
  console.log('Input: { "review_text": "This code is bad, fix it" }');
  console.log('-'.repeat(50));
  console.log('Calling Groq API (Llama 3.3 70B)...');

  const prompt = `You are a code review coach. Improve this review to be more helpful. Respond ONLY with valid JSON, no markdown.

Original review: "This code is bad, fix it"

JSON format:
{"improved_review": "...", "changes_made": ["..."], "tips": ["..."]}`;

  try {
    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    console.log('Output:', JSON.stringify({ success: true, original: "This code is bad, fix it", ...result }, null, 2));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

async function demo4_AnalyzePR() {
  console.log('\n📋 Tool: analyze_pr_reviews (REAL GitHub + AI)\n');
  console.log(`Input: { "owner": "${GITHUB_OWNER}", "repo": "${GITHUB_REPO}" }`);
  console.log('-'.repeat(50));
  console.log('Fetching recent PRs from GitHub API...');

  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

  try {
    // First get list of PRs, then pick the first one
    const prsListRes = await axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=all&per_page=5`, { headers });
    
    if (prsListRes.data.length === 0) {
      console.log('No PRs found in this repository');
      return;
    }
    
    const prNumber = prsListRes.data[0].number;
    console.log(`Analyzing PR #${prNumber}...`);
    
    const [prRes, reviewsRes, commentsRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}`, { headers }),
      axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/reviews`, { headers }),
      axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/comments`, { headers }),
    ]);

    const pr = prRes.data;
    const reviews = reviewsRes.data;
    const comments = commentsRes.data;

    console.log(`Found PR: "${pr.title}" by ${pr.user?.login}`);
    console.log(`Reviews: ${reviews.length}, Comments: ${comments.length}`);
    console.log('Analyzing with Gemini AI...');

    const prompt = `Analyze these code reviews and respond ONLY with valid JSON.

PR: ${pr.title}
Reviews: ${JSON.stringify(reviews.slice(0, 5).map((r: any) => ({ body: r.body?.slice(0, 200), state: r.state })))}
Comments: ${JSON.stringify(comments.slice(0, 5).map((c: any) => ({ body: c.body?.slice(0, 200) })))}

Score 0-25 for: clarity, completeness, actionability, constructiveness.

JSON format:
{"overall_score": N, "dimensions": {"clarity": N, "completeness": N, "actionability": N, "constructiveness": N}, "summary": "...", "recommendations": ["..."]}`;

    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    console.log('Output:', JSON.stringify({
      success: true,
      pr_number: 31083,
      pr_title: pr.title,
      pr_author: pr.user?.login,
      review_count: reviews.length,
      comment_count: comments.length,
      ...analysis
    }, null, 2));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

async function demo5_TeamStats() {
  console.log('\n📋 Tool: get_team_stats (REAL GitHub)\n');
  console.log(`Input: { "owner": "${GITHUB_OWNER}", "repo": "${GITHUB_REPO}", "days": 30 }`);
  console.log('-'.repeat(50));
  console.log('Fetching from GitHub API...');

  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

  try {
    const prsRes = await axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=all&per_page=10`, { headers });
    
    const reviewers: Record<string, { count: number }> = {};
    let totalReviews = 0;

    for (const pr of prsRes.data.slice(0, 5)) {
      const reviewsRes = await axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${pr.number}/reviews`, { headers });
      for (const review of reviewsRes.data) {
        const author = review.user?.login || 'unknown';
        if (!reviewers[author]) reviewers[author] = { count: 0 };
        reviewers[author].count++;
        totalReviews++;
      }
    }

    const topReviewers = Object.entries(reviewers)
      .map(([name, stats]) => ({ reviewer: name, review_count: stats.count }))
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 5);

    console.log('Output:', JSON.stringify({
      success: true,
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      period_days: 30,
      total_reviews: totalReviews,
      top_reviewers: topReviewers
    }, null, 2));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

async function demo6_AutoFixAgent() {
  console.log('\n📋 Tool: auto_fix_from_review (AI AUTO-FIX AGENT)\n');
  console.log(`Input: { "owner": "${GITHUB_OWNER}", "repo": "${GITHUB_REPO}", "pr_number": 1 }`);
  console.log('-'.repeat(50));
  console.log('🤖 AI Agent analyzing PR feedback and generating fixes...');

  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

  try {
    // Get first PR with reviews
    const prsRes = await axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=all&per_page=5`, { headers });
    
    if (prsRes.data.length === 0) {
      console.log('No PRs found');
      return;
    }

    const prNumber = prsRes.data[0].number;
    const pr = prsRes.data[0];
    
    // Fetch reviews and comments
    const [reviewsRes, commentsRes, filesRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/reviews`, { headers }),
      axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/comments`, { headers }),
      axios.get(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/files`, { headers }),
    ]);

    const reviews = reviewsRes.data;
    const comments = commentsRes.data;
    const files = filesRes.data;

    // Extract feedback
    const feedback: any[] = [];
    for (const comment of comments) {
      if (comment.body) {
        feedback.push({ type: 'inline', file: comment.path, line: comment.line, body: comment.body.slice(0, 200) });
      }
    }
    for (const review of reviews) {
      if (review.body && ['CHANGES_REQUESTED', 'COMMENTED'].includes(review.state)) {
        feedback.push({ type: 'review', body: review.body.slice(0, 200), state: review.state });
      }
    }

    console.log(`Found PR #${prNumber}: "${pr.title}"`);
    console.log(`Feedback items: ${feedback.length}, Files changed: ${files.length}`);

    if (feedback.length === 0) {
      console.log('Output:', JSON.stringify({
        success: true,
        pr_number: prNumber,
        message: 'No actionable feedback found',
        fixes: []
      }, null, 2));
      return;
    }

    console.log('Generating AI-powered fixes...');

    const prompt = `You are an AI auto-fix agent. Analyze review feedback and generate code fixes.

PR #${prNumber}: ${pr.title}

Feedback:
${JSON.stringify(feedback.slice(0, 5), null, 2)}

Files:
${JSON.stringify(files.slice(0, 3).map((f: any) => ({ filename: f.filename, patch: (f.patch || '').slice(0, 300) })), null, 2)}

Generate fixes. Respond ONLY with JSON:
{
  "fixes": [{"file": "...", "line": N, "issue": "...", "fixed_code": "...", "confidence": N}],
  "summary": "...",
  "unfixable": ["..."]
}`;

    const response = await analyzeWithAI(prompt);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    const CONFIDENCE_THRESHOLD = 70;
    const approvedFixes = (analysis.fixes || []).filter((f: any) => f.confidence >= CONFIDENCE_THRESHOLD);
    const needsReviewFixes = (analysis.fixes || []).filter((f: any) => f.confidence < CONFIDENCE_THRESHOLD);

    console.log('Output:', JSON.stringify({
      success: true,
      pr_number: prNumber,
      pr_title: pr.title,
      feedback_count: feedback.length,
      summary: analysis.summary,
      stats: {
        total_fixes: (analysis.fixes || []).length,
        auto_approved: approvedFixes.length,
        needs_review: needsReviewFixes.length
      },
      approved_fixes: approvedFixes.slice(0, 2).map((f: any) => ({
        file: f.file,
        issue: f.issue?.slice(0, 80),
        confidence: f.confidence,
        decision: 'AUTO_APPROVE ✅'
      })),
      needs_review: needsReviewFixes.slice(0, 2).map((f: any) => ({
        file: f.file,
        issue: f.issue?.slice(0, 80),
        confidence: f.confidence,
        decision: 'NEEDS_REVIEW ⚠️'
      }))
    }, null, 2));

    console.log('\n🤖 Auto-Fix Agent Decision:');
    console.log(`   ✅ ${approvedFixes.length} fixes auto-approved (confidence ≥ ${CONFIDENCE_THRESHOLD}%)`);
    console.log(`   ⚠️  ${needsReviewFixes.length} fixes need human review`);

  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

async function main() {
  try {
    await demo1_ScoreReview();
    await demo2_ScoreGoodReview();
    await demo3_SuggestImprovements();
    await demo4_AnalyzePR();
    await demo5_TeamStats();
    await demo6_AutoFixAgent();
  } catch (e) {
    console.error('Demo error:', e);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 MCP Tools Summary:');
  console.log('   • analyze_pr_reviews    - Analyze GitHub PR review quality');
  console.log('   • score_review_text     - Score individual review comments');
  console.log('   • suggest_improvements  - AI suggestions to improve reviews');
  console.log('   • submit_feedback       - RLHF feedback for model training');
  console.log('   • get_team_stats        - Team performance metrics');
  console.log('   • auto_fix_from_review  - 🤖 AI Agent: Auto-fix code from reviews\n');
  console.log('These tools extend Cline CLI via Model Context Protocol (MCP)');
  console.log('='.repeat(60) + '\n');
}

main();

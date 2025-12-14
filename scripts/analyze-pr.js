const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MODELS = [
  'mistralai/devstral-2512:free',
  'qwen/qwen3-coder:free',
  'google/gemma-3n-e4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free'
];

async function callOpenRouter(prompt) {
  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`);
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 256
      }, {
        timeout: 20000,
        headers: {
          'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://review-forge.dev'
        }
      });
      return res.data.choices[0].message.content;
    } catch (e) {
      if (e.response?.status === 429) {
        console.log(`Rate limited on ${model}, trying next...`);
        continue;
      }
      throw e;
    }
  }
  throw new Error('All models rate limited');
}

async function analyze() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const prNumber = process.env.PR_NUMBER;
  
  if (!owner || !repo || !prNumber) throw new Error('Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, or PR_NUMBER');
  if (!process.env.GITHUB_TOKEN) throw new Error('Missing GITHUB_TOKEN');
  if (!process.env.OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY');

  console.log(`🔥 Review-Forge: Analyzing PR #${prNumber}`);

  const headers = {
    'Authorization': 'token ' + process.env.GITHUB_TOKEN,
    'Accept': 'application/vnd.github.v3+json'
  };

  // Fetch reviews and comments
  const [reviewsRes, commentsRes] = await Promise.all([
    axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, { headers }),
    axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`, { headers })
  ]);

  const reviews = reviewsRes.data;
  const comments = commentsRes.data;

  if (reviews.length === 0 && comments.length === 0) {
    console.log('📋 No reviews yet. Waiting for CodeRabbit...');
    return;
  }

  // Score with AI
  const reviewText = reviews.map(r => r.body || '').join('\n') + comments.map(c => c.body || '').join('\n');

  const prompt = `Score this code review (0-100). Respond with JSON only: {"score": N, "summary": "..."}\n\nReview:\n${reviewText.slice(0, 2000)}`;
  const aiResponse = await callOpenRouter(prompt);

  const result = JSON.parse(aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

  console.log(`📊 Review Quality Score: ${result.score}/100`);
  console.log(`📝 Summary: ${result.summary}`);

  // Post comment on PR
  await axios.post(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      body: `## 🔥 Review-Forge Analysis\n\n**Quality Score:** ${result.score}/100\n\n**Summary:** ${result.summary}\n\n---\n_Automated by Review-Forge_`
    },
    { headers }
  );

  // AUTO-SUBMIT FEEDBACK TO OUMI TRAINING (explicit opt-in only)
  if (process.env.ENABLE_OUMI_FEEDBACK !== 'true') {
    console.log('📝 Oumi feedback collection disabled (set ENABLE_OUMI_FEEDBACK=true to enable)');
    return;
  }
  
  const feedbackFile = path.join(process.cwd(), 'oumi', 'data', 'feedback.jsonl');

  const trainingData = {
    prompt: `Score this code review: "${reviewText.slice(0, 200).replace(/"/g, "'")}"`,
    chosen: `Score: ${result.score}/100\nClarity: ${Math.round(result.score/4)}/25\nCompleteness: ${Math.round(result.score/4)}/25\nActionability: ${Math.round(result.score/4)}/25\nConstructiveness: ${Math.round(result.score/4)}/25`,
    rejected: `Score: ${100 - result.score}/100 - Incorrect`,
    feedback_type: result.score >= 50 ? 'positive' : 'negative',
    review_id: `pr-${prNumber}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    source: 'github_action'
  };

  try {
    fs.mkdirSync(path.dirname(feedbackFile), { recursive: true });
    fs.appendFileSync(feedbackFile, JSON.stringify(trainingData) + '\n');
    console.log('📥 Feedback auto-saved to Oumi training data!');
  } catch (err) {
    console.log('Could not save feedback:', err.message);
  }
}

analyze().catch(err => {
  console.error('Analysis failed:', err.message);
  process.exit(1);
});

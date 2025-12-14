#!/bin/bash
# Test Kestra Workflow Locally (without Kestra server)
# This simulates what the Kestra workflow does

echo "🔥 Review-Forge: Testing Kestra Workflow Locally"
echo "=================================================="

# Check for required env vars
if [ -z "$GROQ_API_KEY" ]; then
    echo "⚠️  GROQ_API_KEY not set. Using default for demo."
    export GROQ_API_KEY="<>"
fi

OWNER=${1:-mohamedkaseem}
REPO=${2:-self-healing-agent}

echo ""
echo "📦 Repository: $OWNER/$REPO"
echo ""

# Step 1: Fetch PRs (simulating Kestra task)
echo "📋 Step 1: Fetching PRs from GitHub..."
PRS=$(curl -s "https://api.github.com/repos/$OWNER/$REPO/pulls?state=all&per_page=3")
PR_COUNT=$(echo $PRS | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
echo "   Found $PR_COUNT PRs"

# Step 2: Fetch Reviews (simulating Kestra task)
echo ""
echo "📋 Step 2: Fetching Reviews..."
FIRST_PR=$(echo $PRS | python3 -c "import sys, json; prs=json.load(sys.stdin); print(prs[0]['number'] if prs else 0)")
if [ "$FIRST_PR" != "0" ]; then
    REVIEWS=$(curl -s "https://api.github.com/repos/$OWNER/$REPO/pulls/$FIRST_PR/reviews")
    REVIEW_COUNT=$(echo $REVIEWS | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
    echo "   PR #$FIRST_PR has $REVIEW_COUNT reviews"
fi

# Step 3: AI Analysis (simulating Kestra AI agent)
echo ""
echo "📋 Step 3: AI Agent Analyzing Reviews..."
echo "   Using Groq (Llama 3.3 70B)..."

# Use Node.js instead of Python to avoid pip issues
node << 'NODE_SCRIPT'
const Groq = require('groq-sdk');

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const prompt = `You are a code review quality scorer. 
Analyze this sample review and score it.

Review: "This implementation looks good overall. Consider adding error handling for the null case on line 42. The async function could benefit from a try-catch block."

Score 0-25 for each dimension and provide JSON response only:
{"overall_score": N, "clarity": N, "completeness": N, "actionability": N, "constructiveness": N, "decision": "approve|suggest_improvements|flag_for_review"}`;

async function analyze() {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 256
    });
    
    const text = response.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);
    
    console.log(`   Overall Score: ${result.overall_score}/100`);
    console.log(`   - Clarity: ${result.clarity}/25`);
    console.log(`   - Completeness: ${result.completeness}/25`);
    console.log(`   - Actionability: ${result.actionability}/25`);
    console.log(`   - Constructiveness: ${result.constructiveness}/25`);
    console.log(``);
    console.log(`🤖 AI Agent Decision: ${result.decision.toUpperCase()}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
    console.log(`   Using mock data for demo...`);
    console.log(`   Overall Score: 78/100`);
    console.log(`   - Clarity: 20/25`);
    console.log(`   - Completeness: 18/25`);
    console.log(`   - Actionability: 22/25`);
    console.log(`   - Constructiveness: 18/25`);
    console.log(``);
    console.log(`🤖 AI Agent Decision: SUGGEST_IMPROVEMENTS`);
  }
}

analyze();
NODE_SCRIPT

echo ""
echo "=================================================="
echo "✅ Kestra Workflow Simulation Complete!"
echo ""
echo "To run actual Kestra:"
echo "  1. Install Kestra: docker run -p 8080:8080 kestra/kestra:latest"
echo "  2. Upload flows: kestra/flows/*.yml"
echo "  3. Trigger via UI or API"

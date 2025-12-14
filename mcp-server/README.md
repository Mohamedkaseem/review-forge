# Review-Forge MCP Server

**MCP (Model Context Protocol) Server for Cline CLI Integration**

This package extends Cline's capabilities with code review quality analysis tools, enabling autonomous review scoring directly from the Cline CLI.

## 🎯 Purpose

This MCP server satisfies the **Cline CLI Award** requirement by building capabilities ON TOP of Cline that improve the software development experience through automated code review quality analysis.

## 🔧 Tools Provided

| Tool | Description |
|------|-------------|
| `analyze_pr_reviews` | Analyze review quality for a GitHub PR (scores clarity, completeness, actionability, constructiveness) |
| `score_review_text` | Score a single review comment text (0-100) |
| `suggest_review_improvements` | Get AI suggestions to improve a review comment |
| `submit_feedback` | Submit feedback to improve the RL model |
| `get_team_stats` | Get review quality statistics for a team |

## 🚀 Installation

### 1. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure Cline to Use This Server

Add to your Cline MCP settings (VS Code: `cline.mcpServers` or `~/.config/cline/mcp.json`):

```json
{
  "mcpServers": {
    "review-forge": {
      "command": "node",
      "args": ["/path/to/review-forge/mcp-server/dist/index.js"],
      "env": {
        "GROQ_API_KEY": "your-groq-api-key",
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

### 3. Use with Cline

Once configured, you can ask Cline:

- *"Analyze the reviews for PR #123 in facebook/react"*
- *"Score this review: 'LGTM'"*
- *"How can I improve this review comment?"*
- *"Get team review stats for my repo"*

## 📋 Example Usage

### In Cline CLI

```
> Analyze the code reviews for PR #456 in my-org/my-repo

Cline will use the analyze_pr_reviews tool and return:
{
  "pr_number": 456,
  "overall_score": 78,
  "dimensions": {
    "clarity": 20,
    "completeness": 18,
    "actionability": 22,
    "constructiveness": 18
  },
  "recommendations": [
    "Add more specific code references",
    "Include performance considerations"
  ]
}
```

### Scoring a Review

```
> Score this review: "Looks good to me"

{
  "overall_score": 15,
  "dimensions": {
    "clarity": 5,
    "completeness": 3,
    "actionability": 2,
    "constructiveness": 5
  },
  "explanation": "This review lacks specificity and actionable feedback..."
}
```

## 🔄 Integration with Review-Forge Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                     Cline CLI                                │
│  "Analyze reviews for PR #123"                              │
└─────────────────┬───────────────────────────────────────────┘
                  │ MCP Protocol
                  ▼
┌─────────────────────────────────────────────────────────────┐
│            Review-Forge MCP Server                          │
│  - analyze_pr_reviews                                       │
│  - score_review_text                                        │
│  - suggest_review_improvements                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
          ┌───────┴───────┐
          ▼               ▼
┌─────────────────┐ ┌─────────────────┐
│   GitHub API    │ │    Groq AI      │
│  (fetch PRs)    │ │  (analysis)     │
└─────────────────┘ └─────────────────┘
```

## 🏆 Hackathon Compliance

This MCP server demonstrates:

1. **Building on Cline CLI**: Extends Cline with new tools via MCP
2. **Automation**: Enables automated code review quality analysis
3. **Developer Experience**: Improves software development workflow

## 📄 License

MIT

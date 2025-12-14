"""
Data Synthesis for Review-Forge
Generates synthetic training data for the review quality scorer using LLM-as-a-Judge.
"""

import json
import os
from typing import List, Dict, Any
from dataclasses import dataclass
import random


@dataclass
class ReviewExample:
    """A code review example for training."""
    review_text: str
    pr_title: str
    pr_description: str
    quality_label: str  # "good", "moderate", "poor"
    dimensions: Dict[str, int]  # clarity, completeness, actionability, constructiveness
    overall_score: int


# Template review patterns for different quality levels
GOOD_REVIEW_TEMPLATES = [
    "Great implementation! A few suggestions: 1) {suggestion1} 2) {suggestion2}. The {aspect} looks solid.",
    "I reviewed the {aspect} and it looks good. Consider {suggestion1} for better {benefit}. Also, {suggestion2}.",
    "Nice work on {aspect}. Two things to consider: {suggestion1}, and {suggestion2}. Overall, well done!",
    "The code is clean and well-structured. {suggestion1}. Additionally, {suggestion2} would improve {benefit}.",
]

MODERATE_REVIEW_TEMPLATES = [
    "Looks okay. Maybe consider {suggestion1}.",
    "The {aspect} seems fine. {suggestion1}.",
    "I think this works. One thing: {suggestion1}.",
    "Generally good, but {suggestion1}.",
]

POOR_REVIEW_TEMPLATES = [
    "LGTM",
    "Looks good to me",
    "👍",
    "Approved",
    "Fine",
    "OK",
    "This is wrong.",
    "Fix this.",
    "Bad code.",
]

ASPECTS = [
    "authentication logic", "error handling", "database queries", "API endpoints",
    "validation logic", "caching implementation", "logging", "test coverage",
    "type definitions", "null checks", "boundary conditions", "performance",
]

SUGGESTIONS = [
    "add input validation", "handle edge cases", "add error logging",
    "consider rate limiting", "add unit tests", "use constants for magic numbers",
    "extract to a helper function", "add documentation", "consider async handling",
    "add retry logic", "validate user input", "check for null values",
    "add timeout handling", "consider pagination", "use prepared statements",
]

BENEFITS = [
    "maintainability", "performance", "security", "readability",
    "testability", "scalability", "reliability", "debugging",
]

PR_TITLES = [
    "Add user authentication", "Fix pagination bug", "Update API endpoints",
    "Refactor database layer", "Add caching layer", "Implement search feature",
    "Fix memory leak", "Add rate limiting", "Update dependencies",
    "Improve error handling", "Add logging", "Fix security vulnerability",
]


def generate_good_review() -> ReviewExample:
    """Generate a high-quality review example."""
    template = random.choice(GOOD_REVIEW_TEMPLATES)
    review = template.format(
        aspect=random.choice(ASPECTS),
        suggestion1=random.choice(SUGGESTIONS),
        suggestion2=random.choice(SUGGESTIONS),
        benefit=random.choice(BENEFITS),
    )
    
    return ReviewExample(
        review_text=review,
        pr_title=random.choice(PR_TITLES),
        pr_description=f"This PR implements {random.choice(ASPECTS)} improvements.",
        quality_label="good",
        dimensions={
            "clarity": random.randint(20, 25),
            "completeness": random.randint(18, 25),
            "actionability": random.randint(20, 25),
            "constructiveness": random.randint(20, 25),
        },
        overall_score=random.randint(80, 95),
    )


def generate_moderate_review() -> ReviewExample:
    """Generate a moderate-quality review example."""
    template = random.choice(MODERATE_REVIEW_TEMPLATES)
    review = template.format(
        aspect=random.choice(ASPECTS),
        suggestion1=random.choice(SUGGESTIONS),
    )
    
    return ReviewExample(
        review_text=review,
        pr_title=random.choice(PR_TITLES),
        pr_description=f"This PR updates {random.choice(ASPECTS)}.",
        quality_label="moderate",
        dimensions={
            "clarity": random.randint(15, 20),
            "completeness": random.randint(12, 18),
            "actionability": random.randint(14, 20),
            "constructiveness": random.randint(15, 20),
        },
        overall_score=random.randint(55, 75),
    )


def generate_poor_review() -> ReviewExample:
    """Generate a poor-quality review example."""
    review = random.choice(POOR_REVIEW_TEMPLATES)
    
    return ReviewExample(
        review_text=review,
        pr_title=random.choice(PR_TITLES),
        pr_description=f"This PR fixes {random.choice(ASPECTS)} issues.",
        quality_label="poor",
        dimensions={
            "clarity": random.randint(5, 12),
            "completeness": random.randint(2, 10),
            "actionability": random.randint(2, 8),
            "constructiveness": random.randint(5, 12),
        },
        overall_score=random.randint(15, 45),
    )


def create_training_prompt(example: ReviewExample) -> str:
    """Create a training prompt from a review example."""
    return f"""Score this code review comment:

PR Title: {example.pr_title}
PR Description: {example.pr_description}

Review Comment: "{example.review_text}"

Analyze the review quality on these dimensions (0-25 each):
1. Clarity - How clear and understandable is the feedback?
2. Completeness - Does it cover important aspects of the code?
3. Actionability - Are the suggestions specific and actionable?
4. Constructiveness - Is the tone helpful and professional?

Provide an overall score (0-100) and brief explanation."""


def create_training_response(example: ReviewExample) -> str:
    """Create the expected response for training."""
    dims = example.dimensions
    total = sum(dims.values())
    
    quality_descriptions = {
        "good": "This is a high-quality review that provides clear, actionable feedback.",
        "moderate": "This review has some value but could be more detailed and specific.",
        "poor": "This review lacks substance and provides little actionable feedback.",
    }
    
    return f"""Score: {example.overall_score}/100

Dimension Breakdown:
- Clarity: {dims['clarity']}/25
- Completeness: {dims['completeness']}/25
- Actionability: {dims['actionability']}/25
- Constructiveness: {dims['constructiveness']}/25

{quality_descriptions[example.quality_label]}

The review {"provides specific suggestions that can be acted upon" if example.quality_label == "good" else "could benefit from more specific, actionable feedback"}."""


def generate_dataset(num_examples: int = 100, output_path: str = "./data/training_data.jsonl"):
    """Generate a synthetic dataset for training."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    examples = []
    
    # Generate balanced dataset
    for _ in range(num_examples // 3):
        examples.append(generate_good_review())
        examples.append(generate_moderate_review())
        examples.append(generate_poor_review())
    
    # Shuffle
    random.shuffle(examples)
    
    # Write to JSONL
    with open(output_path, 'w') as f:
        for ex in examples:
            data = {
                "prompt": create_training_prompt(ex),
                "chosen": create_training_response(ex),
                "rejected": f"Score: {random.randint(0, 100)}/100\nThis review is okay.",
                "feedback": "positive" if ex.quality_label == "good" else "negative",
                "metadata": {
                    "quality_label": ex.quality_label,
                    "dimensions": ex.dimensions,
                    "overall_score": ex.overall_score,
                }
            }
            f.write(json.dumps(data) + "\n")
    
    print(f"Generated {len(examples)} training examples to {output_path}")
    return examples


def llm_as_judge_score(review_text: str, client=None) -> Dict[str, Any]:
    """
    Use LLM-as-a-Judge to score a review.
    This function can be used with the Oumi LLM-as-a-Judge feature.
    """
    prompt = f"""You are a code review quality judge. Score the following review on a scale of 0-100.

Review: "{review_text}"

Evaluate on these criteria:
1. Clarity (0-25): Is the feedback clear and understandable?
2. Completeness (0-25): Does it address important code aspects?
3. Actionability (0-25): Are suggestions specific and actionable?
4. Constructiveness (0-25): Is the tone helpful and professional?

Respond in JSON format:
{{
    "overall_score": <0-100>,
    "clarity": <0-25>,
    "completeness": <0-25>,
    "actionability": <0-25>,
    "constructiveness": <0-25>,
    "reasoning": "<brief explanation>"
}}"""

    if client:
        # Use provided LLM client
        response = client.generate(prompt)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass
    
    # Fallback to heuristic scoring
    score = 50
    dimensions = {"clarity": 12, "completeness": 12, "actionability": 12, "constructiveness": 12}
    
    # Simple heuristics
    if len(review_text) < 20:
        score = 20
        dimensions = {k: 5 for k in dimensions}
    elif len(review_text) > 100 and any(word in review_text.lower() for word in ["suggest", "consider", "recommend"]):
        score = 80
        dimensions = {k: 20 for k in dimensions}
    
    return {
        "overall_score": score,
        **dimensions,
        "reasoning": "Heuristic-based scoring"
    }


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate synthetic training data")
    parser.add_argument("--num-examples", type=int, default=100)
    parser.add_argument("--output", type=str, default="./data/training_data.jsonl")
    
    args = parser.parse_args()
    
    generate_dataset(args.num_examples, args.output)

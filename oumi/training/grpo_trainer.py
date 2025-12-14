"""
Review-Forge GRPO Training Script
Uses Oumi's GRPO (Group Relative Policy Optimization) for reinforcement learning
to train a model that scores code review quality.
"""

import os
import json
import torch
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from pathlib import Path

from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import Dataset, load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import GRPOConfig, GRPOTrainer

@dataclass
class ReviewForgeConfig:
    """Configuration for Review-Forge GRPO training."""
    model_name: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    output_dir: str = "./models/review-scorer"
    data_path: str = "./data/feedback.jsonl"
    
    # Training parameters (optimized for CPU/free-tier)
    num_train_epochs: int = 3
    per_device_train_batch_size: int = 1
    gradient_accumulation_steps: int = 4
    learning_rate: float = 1e-5
    max_length: int = 512
    
    # GRPO specific
    num_generations: int = 2
    temperature: float = 0.7
    
    # LoRA parameters
    lora_r: int = 8
    lora_alpha: int = 16
    lora_dropout: float = 0.1
    
    # Logging
    logging_steps: int = 10
    save_steps: int = 100
    eval_steps: int = 50


def load_feedback_data(data_path: str) -> Dataset:
    """Load feedback data for GRPO training."""
    data = []
    
    if os.path.exists(data_path):
        with open(data_path, 'r') as f:
            for line in f:
                try:
                    item = json.loads(line.strip())
                    data.append(item)
                except json.JSONDecodeError:
                    continue
    
    # If no data, create synthetic examples
    if not data:
        data = create_synthetic_data()
    
    return Dataset.from_list(data)


def create_synthetic_data() -> List[Dict[str, Any]]:
    """Create synthetic training data for demonstration."""
    examples = [
        {
            "prompt": """Score this code review comment:
Review: "LGTM"
PR: Add user authentication
Score the review quality (0-100) and explain.""",
            "chosen": """Score: 25/100

This review is of low quality because:
- Clarity: 5/25 - "LGTM" provides no specific feedback
- Completeness: 5/25 - Does not address any code aspects
- Actionability: 5/25 - No actionable suggestions
- Constructiveness: 10/25 - At least positive, but unhelpful

Recommendation: Provide specific feedback on what was reviewed and any concerns.""",
            "rejected": """Score: 80/100
The review is good because the reviewer approved it.""",
            "feedback": "negative"
        },
        {
            "prompt": """Score this code review comment:
Review: "The authentication logic looks solid. Consider adding rate limiting to prevent brute force attacks. Also, the password hashing uses bcrypt which is good, but ensure the salt rounds are at least 12."
PR: Add user authentication
Score the review quality (0-100) and explain.""",
            "chosen": """Score: 88/100

This is a high-quality review:
- Clarity: 23/25 - Clear and specific feedback
- Completeness: 22/25 - Covers security aspects thoroughly
- Actionability: 22/25 - Specific suggestions (rate limiting, salt rounds)
- Constructiveness: 21/25 - Positive acknowledgment with improvements

Excellent review that balances praise with actionable security recommendations.""",
            "rejected": """Score: 50/100
The review mentions some things but could be better.""",
            "feedback": "positive"
        },
        {
            "prompt": """Score this code review comment:
Review: "This code is terrible. Who wrote this? You should learn to code properly."
PR: Fix pagination bug
Score the review quality (0-100) and explain.""",
            "chosen": """Score: 10/100

This is a very poor quality review:
- Clarity: 5/25 - No specific issues identified
- Completeness: 0/25 - Doesn't mention what's wrong
- Actionability: 0/25 - No suggestions for improvement
- Constructiveness: 5/25 - Rude and unhelpful tone

This review violates code of conduct and provides no value. Reviews should focus on code, not the author.""",
            "rejected": """Score: 40/100
The reviewer is honest about the code quality.""",
            "feedback": "negative"
        },
        {
            "prompt": """Score this code review comment:
Review: "Good implementation of pagination. A few suggestions: 1) Consider using cursor-based pagination for better performance with large datasets. 2) Add validation for page size to prevent DoS. 3) The SQL query on line 45 could benefit from an index."
PR: Fix pagination bug
Score the review quality (0-100) and explain.""",
            "chosen": """Score: 92/100

Excellent review quality:
- Clarity: 24/25 - Very clear, numbered points
- Completeness: 23/25 - Covers performance, security, and optimization
- Actionability: 23/25 - Specific line numbers and suggestions
- Constructiveness: 22/25 - Positive opening, helpful suggestions

This review demonstrates best practices: specific, actionable, and constructive.""",
            "rejected": """Score: 60/100
The review has some good points.""",
            "feedback": "positive"
        },
    ]
    
    return examples


def create_reward_function():
    """Create reward function based on human feedback."""
    def reward_fn(completions: List[str], prompts: List[str], **kwargs) -> List[float]:
        rewards = []
        for completion in completions:
            # Simple heuristic-based reward
            reward = 0.0
            
            # Reward for structured response
            if "Score:" in completion:
                reward += 0.3
            if "/25" in completion or "/100" in completion:
                reward += 0.2
            
            # Reward for dimension coverage
            dimensions = ["Clarity", "Completeness", "Actionability", "Constructiveness"]
            for dim in dimensions:
                if dim.lower() in completion.lower():
                    reward += 0.1
            
            # Reward for recommendations
            if "recommend" in completion.lower() or "suggest" in completion.lower():
                reward += 0.2
            
            # Penalize very short responses
            if len(completion) < 100:
                reward -= 0.3
            
            rewards.append(max(0.0, min(1.0, reward)))
        
        return rewards
    
    return reward_fn


def train_grpo(config: ReviewForgeConfig):
    """Main GRPO training function."""
    print(f"Loading model: {config.model_name}")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "left"
    
    # Load model with quantization for efficiency
    model = AutoModelForCausalLM.from_pretrained(
        config.model_name,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
        low_cpu_mem_usage=True,
    )
    
    # Apply LoRA for efficient fine-tuning
    lora_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        lora_dropout=config.lora_dropout,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        bias="none",
        task_type="CAUSAL_LM",
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # Load training data
    print(f"Loading training data from: {config.data_path}")
    dataset = load_feedback_data(config.data_path)
    print(f"Loaded {len(dataset)} training examples")
    
    # Prepare prompts for GRPO
    def prepare_prompts(examples):
        return {"query": examples["prompt"]}
    
    dataset = dataset.map(prepare_prompts, batched=True)
    
    # GRPO Configuration
    grpo_config = GRPOConfig(
        output_dir=config.output_dir,
        num_train_epochs=config.num_train_epochs,
        per_device_train_batch_size=config.per_device_train_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        learning_rate=config.learning_rate,
        logging_steps=config.logging_steps,
        save_steps=config.save_steps,
        max_length=config.max_length,
        num_generations=config.num_generations,
        temperature=config.temperature,
        remove_unused_columns=False,
    )
    
    # Initialize trainer
    trainer = GRPOTrainer(
        model=model,
        config=grpo_config,
        tokenizer=tokenizer,
        train_dataset=dataset,
        reward_funcs=create_reward_function(),
    )
    
    # Train
    print("Starting GRPO training...")
    trainer.train()
    
    # Save model
    print(f"Saving model to: {config.output_dir}")
    trainer.save_model(config.output_dir)
    tokenizer.save_pretrained(config.output_dir)
    
    print("Training complete!")
    return trainer


def inference(model_path: str, prompt: str) -> str:
    """Run inference with trained model."""
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = inputs.to("cuda")
    
    outputs = model.generate(
        **inputs,
        max_new_tokens=256,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return response[len(prompt):]


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Review-Forge GRPO Training")
    parser.add_argument("--train", action="store_true", help="Run training")
    parser.add_argument("--inference", type=str, help="Run inference with prompt")
    parser.add_argument("--model-path", type=str, default="./models/review-scorer")
    parser.add_argument("--data-path", type=str, default="./data/feedback.jsonl")
    
    args = parser.parse_args()
    
    if args.train:
        config = ReviewForgeConfig(
            output_dir=args.model_path,
            data_path=args.data_path,
        )
        train_grpo(config)
    
    elif args.inference:
        result = inference(args.model_path, args.inference)
        print(result)
    
    else:
        parser.print_help()

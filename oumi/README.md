# Oumi Integration for Review-Forge

This directory contains the Oumi-based reinforcement learning components for training the review quality scorer.

## Overview

Review-Forge uses **GRPO (Group Relative Policy Optimization)** from Oumi to train a model that:
1. Scores code review quality (0-100)
2. Analyzes reviews on 4 dimensions: Clarity, Completeness, Actionability, Constructiveness
3. Learns from human feedback to improve over time

## Features

### 1. GRPO Training (`training/grpo_trainer.py`)
- Uses TinyLlama for CPU-friendly training
- LoRA for efficient fine-tuning
- Custom reward function based on review structure

### 2. Data Synthesis (`training/data_synthesis.py`)
- Generates synthetic training data
- LLM-as-a-Judge scoring capability
- Balanced dataset with good/moderate/poor reviews

## Quick Start

### Installation

```bash
cd oumi
pip install -r requirements.txt
```

### Generate Training Data

```bash
python training/data_synthesis.py --num-examples 100 --output ./data/training_data.jsonl
```

### Train the Model

```bash
python training/grpo_trainer.py --train --data-path ./data/training_data.jsonl --model-path ./models/review-scorer
```

### Run Inference

```bash
python training/grpo_trainer.py --inference "Score this review: 'LGTM'" --model-path ./models/review-scorer
```

## Training Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `model_name` | TinyLlama-1.1B | Base model for fine-tuning |
| `num_train_epochs` | 3 | Number of training epochs |
| `learning_rate` | 1e-5 | Learning rate |
| `lora_r` | 8 | LoRA rank |
| `max_length` | 512 | Maximum sequence length |

## Learning Loop

```
┌─────────────────┐
│   PR Reviews    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Score Reviews  │◄────────────┐
└────────┬────────┘             │
         │                      │
         ▼                      │
┌─────────────────┐             │
│ Human Feedback  │             │
└────────┬────────┘             │
         │                      │
         ▼                      │
┌─────────────────┐             │
│  GRPO Training  │─────────────┘
└─────────────────┘
```

## Reward Function

The reward function evaluates model outputs based on:
- **Structure** (+0.3): Contains "Score:" format
- **Dimensions** (+0.1 each): Mentions Clarity, Completeness, Actionability, Constructiveness
- **Recommendations** (+0.2): Includes actionable suggestions
- **Length** (-0.3 if too short): Penalizes responses under 100 characters

## Files

```
oumi/
├── requirements.txt          # Python dependencies
├── README.md                 # This file
├── training/
│   ├── grpo_trainer.py      # GRPO training script
│   └── data_synthesis.py    # Data generation
└── data/
    └── training_data.jsonl  # Training data (generated)
```

## Integration with Review-Forge

The trained model integrates with:
- **CLI**: `review-forge learn` command sends feedback
- **Dashboard**: Feedback tab collects human ratings
- **Kestra**: Scheduled retraining workflows

## Resources

- [Oumi Documentation](https://oumi.ai/docs)
- [GRPO Paper](https://arxiv.org/abs/2402.03300)
- [TRL Library](https://github.com/huggingface/trl)

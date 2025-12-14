#!/usr/bin/env python3
"""
Oumi Trained Model Server
Serves the trained review scoring model via HTTP API
Run after training to use your custom model instead of Groq
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Try to load the trained model
MODEL_PATH = os.environ.get("OUMI_MODEL_PATH", "./models/review-scorer")
MODEL_LOADED = False
model = None
tokenizer = None

def load_model():
    """Load the trained model if available"""
    global MODEL_LOADED, model, tokenizer
    
    model_path = Path(MODEL_PATH)
    if not model_path.exists():
        print(f"⚠️  Model not found at {MODEL_PATH}")
        print("   Run training first, or use simulation mode")
        return False
    
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch
        
        print(f"Loading model from {MODEL_PATH}...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None
        )
        MODEL_LOADED = True
        print("✅ Model loaded successfully!")
        return True
    except Exception as e:
        print(f"⚠️  Could not load model: {e}")
        return False

def generate_with_model(prompt: str, max_tokens: int = 512, temperature: float = 0.3) -> str:
    """Generate response using the trained model"""
    if not MODEL_LOADED:
        return simulate_response(prompt)
    
    try:
        inputs = tokenizer(prompt, return_tensors="pt")
        if model.device.type == "cuda":
            inputs = inputs.to("cuda")
        
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id
        )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        # Remove the prompt from response
        response = response[len(prompt):].strip()
        return response
    except Exception as e:
        print(f"Generation error: {e}")
        return simulate_response(prompt)

def simulate_response(prompt: str) -> str:
    """Simulate model response for demo (when model not loaded)"""
    # Extract review text from prompt
    review_text = prompt.lower()
    
    # Simple heuristic scoring
    score = 50
    
    # Negative indicators
    if "lgtm" in review_text or "looks good" in review_text:
        score = 15
    elif "fix" in review_text and "code" in review_text and len(review_text) < 50:
        score = 20
    elif "bad" in review_text or "terrible" in review_text:
        score = 25
    # Positive indicators
    elif "consider" in review_text or "suggest" in review_text:
        score += 20
    elif "error handling" in review_text or "edge case" in review_text:
        score += 15
    elif "line" in review_text and any(c.isdigit() for c in review_text):
        score += 10
    
    # Length bonus
    if len(review_text) > 100:
        score += 10
    if len(review_text) > 200:
        score += 10
    
    score = min(95, max(10, score))
    
    clarity = min(25, max(2, score // 4 + (3 if "specific" in review_text else 0)))
    completeness = min(25, max(2, score // 4 + (3 if "also" in review_text else 0)))
    actionability = min(25, max(2, score // 4 + (5 if "should" in review_text or "consider" in review_text else 0)))
    constructiveness = min(25, max(2, score // 4 + (3 if "!" not in review_text or "great" in review_text else -2)))
    
    return json.dumps({
        "overall_score": score,
        "dimensions": {
            "clarity": clarity,
            "completeness": completeness,
            "actionability": actionability,
            "constructiveness": constructiveness
        },
        "explanation": f"Score based on review analysis. {'Low score due to lack of detail.' if score < 50 else 'Good review with actionable feedback.'}"
    })

class ModelHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/generate":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                prompt = data.get("prompt", "")
                max_tokens = data.get("max_tokens", 512)
                temperature = data.get("temperature", 0.3)
                
                response_text = generate_with_model(prompt, max_tokens, temperature)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                self.wfile.write(json.dumps({
                    "text": response_text,
                    "model": "oumi-review-scorer" if MODEL_LOADED else "simulation",
                    "provider": "oumi"
                }).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "model_loaded": MODEL_LOADED,
                "model_path": MODEL_PATH
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[Oumi] {args[0]}")

def main():
    port = 8766
    
    print("🔥 Oumi Model Server")
    print("=" * 50)
    
    # Try to load the model
    load_model()
    
    if not MODEL_LOADED:
        print("\n⚠️  Running in SIMULATION mode")
        print("   To use real model, train first then restart")
    
    print(f"\n📡 Server: http://localhost:{port}")
    print(f"🔧 Generate: POST http://localhost:{port}/generate")
    print(f"❤️  Health:  GET http://localhost:{port}/health")
    print("=" * 50)
    print("\nTo use this model, set in .env:")
    print("  AI_PROVIDER=oumi")
    print("\nPress Ctrl+C to stop\n")
    
    server = HTTPServer(("", port), ModelHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    main()

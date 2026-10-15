"""
Custom LLM-as-a-judge RAG evaluator.
Reads the ground truth dataset, runs the RAG pipeline, and uses a 
stronger LLM (120b) to score the output against the ground truth.
"""

import json
import os
from datetime import datetime
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from backend.rag import troubleshoot_alarm
from sqlalchemy.orm import Session
from backend.models import RAGEvaluation

load_dotenv()

#model to judge
JUDGE_MODEL = "openai/gpt-oss-120b"

#path to the generated dataset
DATASET_PATH = os.path.join(os.path.dirname(__file__), "evaluation_dataset.json")

def load_dataset():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset not found at {DATASET_PATH}.\n"
            "Please ensure ground truth ezists."
        )
    with open(DATASET_PATH, "r" , encoding="utf-8") as f:
        return json.load(f)

def run_evaluation(db: Session):
    print(f"Loading dataset from {DATASET_PATH}...")
    dataset = load_dataset()
    
    print(f"Initializing Judge LLM: {JUDGE_MODEL}...\n")
    judge_llm = ChatGroq(model=JUDGE_MODEL, temperature=0)
    
    total_scores = {
        "context_precision": 0,
        "faithfulness": 0,
        "answer_relevancy": 0,
        "ground_truth_match": 0
    }
    
    detailed_results = []

    for i, case in enumerate(dataset):
        scenario = case["scenario"]
        print(f"--- Evaluating Test Case {i+1}/{len(dataset)}: {scenario['alarm_type']} ---")
        
        # 1. Run the actual RAG pipeline
        result = troubleshoot_alarm(**scenario)
        
        user_input = case["question"]
        response = result["recommendation"]
        context = result["retrieved_context"]
        ground_truth = case["ground_truth"]
        
        # 2. The Judge Prompt
        judge_prompt = f"""You are an expert telecom RAG evaluation judge. Evaluate the following troubleshooting output.

USER QUERY:
{user_input}

RETRIEVED CONTEXT (Max 1500 chars):
{context[:1500]}

LLM RECOMMENDATION (Response):
{response}

EXPECTED GROUND TRUTH (Key actions that MUST be present):
{ground_truth}

Score the following metrics from 1 to 5 (where 5 is perfect, 1 is terrible):
1. Context Precision: Is the retrieved context actually relevant to the user query?
2. Faithfulness: Did the LLM strictly use the context without hallucinating commands, steps, or facts?
3. Answer Relevancy: Did the LLM actually address the specific ticket details and user query?
4. Ground Truth Match: Does the LLM's response contain the key actions/steps mentioned in the Expected Ground Truth?

You MUST output ONLY a valid JSON object with these exact keys and integer values (1-5):
{{
  "context_precision": X,
  "faithfulness": Y,
  "answer_relevancy": Z,
  "ground_truth_match": W
}}
"""
        # 3. Get the Judge's score
        try:
            judge_response = judge_llm.invoke(judge_prompt)
            clean_json = judge_response.content.strip()
            
            # Remove markdown formatting if the LLM adds it
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
                
            scores = json.loads(clean_json.strip())
            
            # Accumulate scores
            total_scores["context_precision"] += scores.get("context_precision", 0)
            total_scores["faithfulness"] += scores.get("faithfulness", 0)
            total_scores["answer_relevancy"] += scores.get("answer_relevancy", 0)
            total_scores["ground_truth_match"] += scores.get("ground_truth_match", 0)
            
            print(f"  Context Precision:  {scores.get('context_precision')}/5")
            print(f"  Faithfulness:       {scores.get('faithfulness')}/5")
            print(f"  Answer Relevancy:   {scores.get('answer_relevancy')}/5")
            print(f"  Ground Truth Match: {scores.get('ground_truth_match')}/5\n")
            
            detailed_results.append({
                "alarm_type": scenario["alarm_type"],
                "scores": scores
            })
            
        except json.JSONDecodeError:
            print("  ⚠️ Error: LLM Judge failed to return valid JSON. Raw output:")
            print(f"  {judge_response.content}\n")
        except Exception as e:
            print(f"  ⚠️ Error during evaluation: {e}\n")

    # 4. Calculate Averages
    num_cases = len(dataset)
    avg_scores = {
        "context_precision": round(total_scores["context_precision"] / num_cases, 2),
        "faithfulness": round(total_scores["faithfulness"] / num_cases, 2),
        "answer_relevancy": round(total_scores["answer_relevancy"] / num_cases, 2),
        "ground_truth_match": round(total_scores["ground_truth_match"] / num_cases, 2),
    }
    avg_scores["overall_score"] = round(sum(avg_scores.values()) / 4, 2)

    # 5. Print Final Summary
    print("=" * 60)
    print("📊 RAG EVALUATION SUMMARY")
    print("=" * 60)
    print(f"Test Cases Evaluated: {num_cases}")
    print(f"Average Context Precision:  {avg_scores['context_precision']}/5")
    print(f"Average Faithfulness:       {avg_scores['faithfulness']}/5")
    print(f"Average Answer Relevancy:   {avg_scores['answer_relevancy']}/5")
    print(f"Average Ground Truth Match: {avg_scores['ground_truth_match']}/5")
    print(f"🏆 OVERALL SCORE:           {avg_scores['overall_score']}/5")
    print("=" * 60)

    # 6. Save to history for Frontend Dashboard
    evaluation = RAGEvaluation(
        timestamp = datetime.now(),
        context_precision = avg_scores["context_precision"],
        faithfulness = avg_scores["faithfulness"],
        answer_relevancy=avg_scores["answer_relevancy"],
        ground_truth_match=avg_scores["ground_truth_match"],
        overall_score=avg_scores["overall_score"],
        num_test_cases=num_cases,
        model_used=JUDGE_MODEL,
        details=detailed_results
    )
    try:
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
    except Exception:
        db.rollback()
        raise

    final_result = {
        "timestamp" : evaluation.timestamp.isoformat(),
        "scores": avg_scores,
        "num_test_cases": num_cases,
        "model_used": JUDGE_MODEL,
        "details": detailed_results
    }

    print("\n✅ Evaluation history saved to PostgreSQL.")
    
    return final_result


if __name__ == "__main__":
    from backend.database import SessionLocal
    db=SessionLocal()
    try:
        run_evaluation(db)
    finally:
        db.close()
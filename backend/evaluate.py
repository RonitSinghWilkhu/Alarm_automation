import json
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from rag import troubleshoot_alarm

load_dotenv()

# 1. Define a small test dataset. 
# Add more dictionaries here to test different alarms.
TEST_CASES = [
    {
        "alarm_type": "HIGH_CPU",
        "node": "NODE-101",
        "occurrence_count": 3,
        "users_impacted": 300,
        "severity": "Critical",
        "threshold_breached": True,
        "impact_level": "HIGH",
        "priority": "P1",
        "assigned_team": "Platform"
    },
    {
        "alarm_type": "POWER_FAILURE",
        "node": "NODE-205",
        "occurrence_count": 3,
        "users_impacted": 1800,
        "severity": "Critical",
        "threshold_breached": True,
        "impact_level": "HIGH",
        "priority": "P1",
        "assigned_team": "Power"
    },
    {
        "alarm_type": "HIGH_TEMPERATURE",
        "node": "NODE-502",
        "occurrence_count": 3,
        "users_impacted": 120,
        "severity": "Critical",
        "threshold_breached": True,
        "impact_level": "HIGH",
        "priority": "P2",
        "assigned_team": "Hardware"
    },
    {
        "alarm_type": "S1_LINK_DOWN",
        "node": "NODE-601",
        "occurrence_count": 3,
        "users_impacted": 1500,
        "severity": "Critical",
        "threshold_breached": True,
        "impact_level": "HIGH",
        "priority": "P1",
        "assigned_team": "Transport"
    },
    {
        "alarm_type": "VSWR_HIGH",
        "node": "NODE-301",
        "occurrence_count": 3,
        "users_impacted": 1000,
        "severity": "Critical",
        "threshold_breached": True,
        "impact_level": "HIGH",
        "priority": "P2",
        "assigned_team": "Radio"
    },
    {
        "alarm_type": "CELL_UNAVAILABLE",
        "node": "NODE-401",
        "occurrence_count": 3,
        "users_impacted": 650,
        "severity": "Critical",
        "threshold_breached": True,
        "impact_level": "HIGH",
        "priority": "P1",
        "assigned_team": "Radio"
    }
]

def run_evaluation():
    # Initialize the Judge LLM.
    judge_llm = ChatGroq(
        model="openai/gpt-oss-20b", 
        temperature=0
    )

    print("Starting RAG Evaluation...\n")

    for i, case in enumerate(TEST_CASES):
        print(f"--- Evaluating Test Case {i+1}: {case['alarm_type']} on {case['node']} ---")
        
        # Run the actual RAG pipeline
        result = troubleshoot_alarm(**case)
        
        user_input = f"Troubleshoot {case['alarm_type']} on node {case['node']}"
        response = result["recommendation"]
        context = result["retrieved_context"]
        
        # 2. The Judge Prompt
        judge_prompt = f"""You are an expert RAG evaluation judge. Evaluate the following telecom troubleshooting output.

TICKET (User Input):
{user_input}

RETRIEVED CONTEXT:
{context}

LLM RECOMMENDATION (Response):
{response}

Score the following metrics from 1 to 5 (where 5 is perfect):
1. Context Relevance: Is the retrieved context actually relevant to the ticket?
2. Faithfulness: Did the LLM strictly use the context without hallucinating commands or steps?
3. Answer Relevance: Did the LLM actually address the specific ticket details?

You MUST output ONLY a valid JSON object with these exact keys and integer values:
{{"context_relevance": X, "faithfulness": Y, "answer_relevance": Z}}
"""
        
        # Get the Judge's score
        judge_response = judge_llm.invoke(judge_prompt)
        
        # 3. Parse the JSON safely
        try:
            clean_json = judge_response.content.strip()
            # Remove markdown formatting if the LLM adds it
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            
            scores = json.loads(clean_json.strip())
            
            print(f"Context Relevance: {scores.get('context_relevance', 'N/A')}/5")
            print(f"Faithfulness:      {scores.get('faithfulness', 'N/A')}/5")
            print(f"Answer Relevance:  {scores.get('answer_relevance', 'N/A')}/5\n")
            
        except json.JSONDecodeError:
            print("Error: LLM Judge failed to return valid JSON. Raw output:")
            print(judge_response.content)
            print("-" * 50 + "\n")

if __name__ == "__main__":
    run_evaluation()
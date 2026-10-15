"""
Generate ground truth answers for RAG evaluation using a stronger LLM.
This reads your knowledge base and creates realistic test cases with expected answers.
"""

import json
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from backend.database import SessionLocal
from backend.models import KnowledgeDocument, HistoricalIncident

load_dotenv()

#model to generate ground truth
GROUND_TRUTH_MODEL = "openai/gpt-oss-120b"

def get_all_knowledge():
    """Fetch all knowledge from PostgreSQL."""
    db=SessionLocal()

    try:
        knowledge_records = db.query(KnowledgeDocument).all()
        incident_records = db.query(HistoricalIncident).all()

        runbooks = [r for r in knowledge_records if r.source_type == "runbook"]
        commands = [r for r in knowledge_records if r.source_type == "commands"]

        return {
            "runbooks": runbooks,
            "commands": commands,
            "incidents": incident_records
        }
    finally:
        db.close()

def generate_ground_truth():
    """Generate ground truth test cases using LLM"""
    llm = ChatGroq(
        model=GROUND_TRUTH_MODEL,
        temperature=0
    )

    knowledge = get_all_knowledge()

    #define test senarios
    test_scenarios = [
        {
            "alarm_type" : "HIGH_CPU",
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
            "occurrence_count": 2,
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
            "occurrence_count": 4,
            "users_impacted": 120,
            "severity": "Major",
            "threshold_breached": True,
            "impact_level": "MEDIUM",
            "priority": "P2",
            "assigned_team": "Hardware"  
        },
        {
            "alarm_type": "S1_LINK_DOWN",
            "node": "NODE-601",
            "occurrence_count": 1,
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
            "occurrence_count": 5,
            "users_impacted": 1000,
            "severity": "Major",
            "threshold_breached": False,
            "impact_level": "MEDIUM",
            "priority": "P2",
            "assigned_team": "Radio"
        },
        {
            "alarm_type": "CELL_UNAVAILABLE",
            "node": "NODE-401",
            "occurrence_count": 2,
            "users_impacted": 650,
            "severity": "Critical",
            "threshold_breached": True,
            "impact_level": "HIGH",
            "priority": "P1",
            "assigned_team": "Radio"
        }
    ]

    ground_truth_dataset = []

    for scenario in test_scenarios:
        print(f"\nGenerating ground truth for {scenario['alarm_type']}...")

        #generate relevant knowledge from this alarm type
        relevant_runbooks = [r for r in knowledge["runbooks"]
                             if scenario["alarm_type"].lower() in r.content.lower()]

        relevant_commands = [c for c in knowledge["commands"]
                             if scenario["alarm_type"].lower() in c.content.lower()]

        relevant_incidents = [i for i in knowledge["incidents"]
                             if i.alarm_type == scenario["alarm_type"]]

        #build context for ground truth generation
        context_parts = []

        if relevant_runbooks:
            context_parts.append("RELEVANT RUNBOOKS:\n" +
                                "\n\n".join([r.content for r in relevant_runbooks[:2]]))

        if relevant_commands:
            context_parts.append("\n\nRELEVANT COMMANDS:\n" + 
                               "\n\n".join([c.content for c in relevant_commands[:2]]))

        if relevant_incidents:
            incident_text = "\n\n".join([
                f"Incident {i.id}: {i.observed_symptoms}\n"
                f"Actions: {i.actions_taken}\n"
                f"Commands: {i.shell_commands_used}\n"
                f"Resolution: {i.resolution}"
                for i in relevant_incidents[:2]
            ])
            context_parts.append("\n\nRELEVANT HISTORICAL INCIDENTS:\n" + incident_text)


        context = "\n".join(context_parts) if context_parts else "No specific knowledge available."

        #generate ground truth using LLM
        prompt = f"""You are a telecom operations expert. Based on the following knowledge base, 
generate the CORRECT troubleshooting response for this alarm scenario.

SCENARIO:
Alarm Type: {scenario['alarm_type']}
Node: {scenario['node']}
Occurrence Count: {scenario['occurrence_count']}
Users Impacted: {scenario['users_impacted']}
Severity: {scenario['severity']}
Threshold Breached: {scenario['threshold_breached']}
Impact Level: {scenario['impact_level']}
Priority: {scenario['priority']}
Assigned Team: {scenario['assigned_team']}

KNOWLEDGE BASE:
{context}

Generate a CORRECT troubleshooting response that includes:
1. What the alarm indicates (1-2 sentences)
2. Why this ticket requires attention (based on impact/severity)
3. Recommended troubleshooting steps (3-5 numbered steps, ONLY from the knowledge base)
4. Relevant diagnostic commands (2-4 commands with explanations, ONLY from knowledge base)
5. Escalation recommendation (1 sentence)

IMPORTANT:
- ONLY use information from the knowledge base
- Do NOT invent commands or steps
- If knowledge is insufficient, state that explicitly
- Be concise and operational

Output ONLY the troubleshooting response, no additional commentary."""

        response = llm.invoke(prompt)
        ground_truth_answer = response.content
        
        # Create test case with ground truth
        test_case = {
            "question": f"How do I troubleshoot {scenario['alarm_type']} on node {scenario['node']}?",
            "answer": ground_truth_answer,
            "contexts": [context[:1000] if context else "No context available"],  # Truncate for RAGAS
            "ground_truth": ground_truth_answer,
            "scenario": scenario
        }
        
        ground_truth_dataset.append(test_case)
        print(f"Generated ground truth for {scenario['alarm_type']}")
    
    # Save to file
    output_path = os.path.join(os.path.dirname(__file__), "evaluation_dataset.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(ground_truth_dataset, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Ground truth dataset saved to: {output_path}")
    print(f"✓ Total test cases: {len(ground_truth_dataset)}")
    
    return ground_truth_dataset

if __name__ == "__main__":
    generate_ground_truth()

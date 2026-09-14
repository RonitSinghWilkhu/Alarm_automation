from langchain_community.document_loaders import TextLoader
from dotenv import load_dotenv
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_groq import ChatGroq

load_dotenv()

# get the kb folder path
BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

runbook_path = os.path.join(
    BASE_DIR,
    "knowledge",
    "telecom_runbooks.txt"
)

command_path = os.path.join(
    BASE_DIR,
    "knowledge",
    "shell_commands.txt"
)

historical_path = os.path.join(
    BASE_DIR,
    "knowledge",
    "historical_incidents.txt"
)

# Lazy-loaded singletons. None until first use.
_llm = None
_vector_store = None


def _get_llm():
    """Create the ChatGroq client once, on first use."""
    global _llm

    if _llm is None:
        _llm = ChatGroq(
            model="openai/gpt-oss-20b",
            temperature=0
        )

    return _llm

ALARM_TYPES = [
    "HIGH_CPU",
    "POWER_FAILURE",
    "HIGH_TEMPERATURE",
    "S1_LINK_DOWN",
    "VSWR_HIGH",
    "CELL_UNAVAILABLE"
]

def detect_alarm_type(content):

    for alarm_type in ALARM_TYPES:

        if alarm_type in content:
            return alarm_type

    return "GENERAL"


def _build_vector_store():
    """Load knowledge files, chunk, tag metadata, and build the FAISS
    index once, on first use."""
    global _vector_store

    if _vector_store is not None:
        return _vector_store

    runbook_loader = TextLoader(
        runbook_path,
        encoding="utf-8"
    )

    runbook_documents = runbook_loader.load()

    command_loader = TextLoader(
        command_path,
        encoding="utf-8"
    )

    command_documents = command_loader.load()

    historical_loader = TextLoader(
        historical_path,
        encoding="utf-8"
    )

    historical_documents = historical_loader.load()

    historical_chunks_raw = []
    for doc in historical_documents:
        for block in doc.page_content.split(
            "--------------------------------------------------"
        ):
            block = block.strip()
            if block:
                historical_chunks_raw.append(
                    Document(page_content=block , metadata=doc.metadata.copy())
                )

    documents = runbook_documents + command_documents

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
        separators=[
            "\n--------------------------------------------------\n",
            "\n\n",
            "\n",
            ""
        ]
    )

    chunks = text_splitter.split_documents(
        documents
    )+ historical_chunks_raw

    for chunk in chunks:

        content = chunk.page_content

        if "HISTORICAL INCIDENT:" in content:
            chunk.metadata["source_type"] = "historical"

        elif "COMMAND REFERENCE:" in content:
            chunk.metadata["source_type"] = "commands"

        else:
            chunk.metadata["source_type"] = "runbook"

        chunk.metadata["alarm_type"] = (
            detect_alarm_type(content)
        )

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    _vector_store = FAISS.from_documents(
        chunks,
        embeddings
    )

    return _vector_store


def troubleshoot_alarm(
        alarm_type,
        node,
        occurrence_count,
        users_impacted,
        severity,
        threshold_breached,
        impact_level,
        priority,
        assigned_team
        ):

    vector_store = _build_vector_store()
    llm = _get_llm()

    query = (
        "How do I troubleshoot "
        + alarm_type
        + "?"
    )

    runbook_results = vector_store.similarity_search(
        query,
        k=2,
        filter={
            "source_type": "runbook",
            "alarm_type": alarm_type
        }
    )

    command_results = vector_store.similarity_search(
        query,
        k=2,
        filter={
            "source_type": "commands"
        }
    )

    historical_results = vector_store.similarity_search(
        query,
        k=2,
        filter={
            "source_type": "historical",
            "alarm_type": alarm_type
        }
    )

    runbook_context = "\n\n".join(
        result.page_content
        for result in runbook_results
    )

    command_context = "\n\n".join(
        result.page_content
        for result in command_results
    )

    historical_context = "\n\n".join(
        result.page_content
        for result in historical_results
    )

    prompt = f"""
You are a telecom operations troubleshooting assistant.

Use the retrieved knowledge to help an operator
troubleshoot the following ticket.

TICKET INFORMATION

Ticket Alarm Type: {alarm_type}
Node: {node}
Occurrence Count: {occurrence_count}
Users Impacted: {users_impacted}
Severity: {severity}
Threshold Breached: {threshold_breached}
Impact Level: {impact_level}
Priority: {priority}
Assigned Team: {assigned_team}

RETRIEVED RUNBOOK KNOWLEDGE
{runbook_context}

RETRIEVED DIAGNOSTIC COMMANDS
{command_context}

RETRIEVED HISTORICAL INCIDENTS
{historical_context}

Provide:

1. What the alarm indicates
2. Why this ticket may require attention based on
   the ticket information
3. Recommended troubleshooting steps
4. Relevant diagnostic commands
5. Escalation recommendation

Formatting rules:
- Use numbered lists for troubleshooting steps.
- Give the commads steps wise like - step 1 and so on
- Use bullet points for diagnostic commands.
- For each command, write the command followed by
  a short explanation.
- Do NOT use Markdown tables.
- Do NOT use table formatting with | characters.
- Do NOT repeat any section.
- Keep the response concise and operational.

Use only commands present in the retrieved knowledge.

Do not invent commands.
Do not automatically execute commands.

Historical incidents represent previous operational experiences and resolutions.

Use historical incidents as supporting evidence when recommending
troubleshooting actions.

Do not assume that a historical resolution is always correct for the current ticket.

Use the current ticket information together with the runbook and historical incident information.

If a historical incident contains a shell command or script, only recommend it if it is relevant to the current alarm.

Do no invent or modify shell commands or scripts.

Do not automatically execute shell commands or scripts.
"""

    response = llm.invoke(prompt)

    return {
        "recommendation": response.content,

        "historicalIncidents": [
            {
                "content": result.page_content,
                "alarmType": result.metadata.get("alarm_type")
            }
            for result in historical_results
        ]
    }


if __name__ == "__main__":
    result = troubleshoot_alarm(
        "HIGH_CPU",
        "NODE-101",
        3,
        250,
        "Major",
        True,
        "HIGH",
        "P4",
        "Platform"
    )

    print("\n--- TROUBLESHOOTING RESULT ---")

    print(result)
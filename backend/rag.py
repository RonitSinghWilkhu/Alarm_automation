from langchain_community.document_loaders import TextLoader
from dotenv import load_dotenv
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_groq import ChatGroq
import re
import uuid
from FlagEmbedding import FlagReranker

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
_reranker = None
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

def _get_reranker():
    """Create the FlagReranker client once, on first use."""
    global _reranker

    if _reranker is None:
        _reranker = FlagReranker(
            'BAAI/bge-reranker-v2-m3',
            use_fp16=False
        )

    return _reranker

# Pre-compile regex patterns for case-insensitive matching and handling variations
ALARM_PATTERNS = {
    "HIGH_CPU": re.compile(r"\bHIGH[_\s-]*CPU\b|\bCPU[_\s-]*(HIGH|UTILIZATION)\b", re.IGNORECASE),
    "POWER_FAILURE": re.compile(r"\bPOWER[_\s-]*(FAILURE|FAIL|LOSS)\b", re.IGNORECASE),
    "HIGH_TEMPERATURE": re.compile(r"\b(HIGH[_\s-]*TEMP|TEMPERATURE[_\s-]*HIGH|OVERHEAT|OVER[_\s-]*TEMP)\b", re.IGNORECASE),
    "S1_LINK_DOWN": re.compile(r"\bS1[_\s-]*LINK[_\s-]*DOWN\b|\bS1[_\s-]*DOWN\b", re.IGNORECASE),
    "VSWR_HIGH": re.compile(r"\bVSWR[_\s-]*(HIGH|ALARM)\b|\bHIGH[_\s-]*VSWR\b", re.IGNORECASE),
    "CELL_UNAVAILABLE": re.compile(r"\bCELL[_\s-]*(UNAVAILABLE|DOWN|OUTAGE)\b", re.IGNORECASE)
}

def detect_alarm_type(content):
    """Uses regex to detect alarm types, handling case variations and formatting."""
    for alarm_type, pattern in ALARM_PATTERNS.items():
        if pattern.search(content):
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

    DELIMITER = "--------------------------------------------------"

    def split_into_blocks(documents):

        blocks = []

        for doc in documents:

            for block in doc.page_content.split(DELIMITER):

                block = block.strip()

                if block:
                    blocks.append(
                        Document(
                            page_content=block,
                            metadata=doc.metadata.copy()
                        )
                    )

        return blocks

    runbook_chunks = split_into_blocks(runbook_documents)
    command_chunks = split_into_blocks(command_documents)
    historical_chunks = split_into_blocks(historical_documents)

    #parent documents
    parents = runbook_chunks+command_chunks+historical_chunks

    #apply metadata to the parents and assign then a unique id
    for parent in parents:
        content = parent.page_content

        if "HISTORICAL INCIDENT:" in content:
            parent.metadata["source_type"] = "historical"

        elif "COMMAND REFERENCE:" in content:
            parent.metadata["source_type"] = "commands"

        else:
            parent.metadata["source_type"] = "runbook"

        parent.metadata["alarm_type"] = detect_alarm_type(content)
        parent.metadata["parent_id"] = str(uuid.uuid4())

    #splitting parents into smaller child documents for precise searching
    child_splitter = RecursiveCharacterTextSplitter(
        chunk_size = 400,
        chunk_overlap = 50
    )

    children = []
    parent_store = {} #dict to store full parent documents

    for parent in parents:
        parent_id = parent.metadata["parent_id"]
        parent_store[parent_id]=parent

        #split parent in childen
        child_docs = child_splitter.split_documents([parent])
        for child in child_docs:
            child.metadata["parent_id"]
            children.append(child)

    #build fiass index for small child documents
    embeddings = HuggingFaceEmbeddings(
        model_name = "BAAI/bge-large-en-v1.5",
        encode_kwargs={"normalize_embeddings": True}
    )

    vectorstore = FAISS.from_documents(children,embeddings)

    #return both the vector store and dict of parents
    return{
        "vectorstore": vectorstore,
        "parent_store": parent_store
    }

def _search_and_fetch_parents(vectorstore, parent_store, query, k, filter_dict , fetch_k=20):
    """Searches for child chunks using MMR for diversity, then fetches the full parent documents."""
    reranker = _get_reranker()

    #using mmr to fetch larger pool of diverse child chunks
    child_results=vectorstore.max_marginal_relevance_search(
        query,
        k= fetch_k,
        fetch_k=fetch_k *2,
        filter=filter_dict
    )

    if not child_results:
        return []

    #reranker scores each query and chunk pair
    pairs = [[query, child.page_content] for child in child_results]
    scores = reranker.compute_score(pairs, normalize=True)

    #sort children by reranker score(highest on the top) and take top k
    scored_children = list(zip(scores , child_results))
    scored_children.sort(key=lambda x:x[0] , reverse = True)
    top_children = [child for _, child in scored_children[:k]]

    #fetch full parent document for top k children
    parents_ids = set()
    parents = []
    for child in top_children:
        p_id = child.metadata.get("parent_id")
        if p_id and p_id not in parents_ids and p_id in parent_store:
            parents_ids.add(p_id)
            parents.append(parent_store[p_id])

    return parents


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

    pipeline = _build_vector_store()
    vectorstore = pipeline["vectorstore"]
    parent_store = pipeline["parent_store"]
    llm = _get_llm()

    query = (
        "How do I troubleshoot "
        + alarm_type
        + "?"
    )

    runbook_results = _search_and_fetch_parents(
        vectorstore,parent_store,query,k=2,
        filter_dict={"source_type": "runbook", "alarm_type": alarm_type}
    )

    command_results = _search_and_fetch_parents(
        vectorstore, parent_store, query, k=2,
        filter_dict={"source_type": "commands"}
    )

    historical_results = _search_and_fetch_parents(
        vectorstore, parent_store, query, k=2,
        filter_dict={"source_type": "historical", "alarm_type": alarm_type}
    )

    if not runbook_results:
        runbook_results = _search_and_fetch_parents(
            vectorstore, parent_store, query, k=2,
            filter_dict={"source_type": "runbook"}
        )

    if not historical_results:
        historical_results = _search_and_fetch_parents(
            vectorstore, parent_store, query, k=2,
            filter_dict={"source_type": "historical"}
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

    if (
        not runbook_context
        and not command_context
        and not historical_context
    ):
        return {
            "recommendation" : (
                "No relevant troubleshooting knowledge was found "
                "for alarm type '"
                + alarm_type
                + "'. Please verify the alarm type or update the "
                "knowledge base."
            ),
            "historicalIncidents" : [],
            "retrieved_context" : ""
        }

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

If a historical incident contains a shell command, only recommend it if it is relevant to the current alarm.

Do not invent or modify shell commands.

Do not automatically execute shell commands.

CRITICAL RULE FOR HALLUCINATION PREVENTION:
If the retrieved knowledge is insufficient to accurately answer the query 
or provide troubleshooting steps, you must explicitly state: "Insufficient data in the knowledge base to resolve this issue."
Do not guess, assume, or invent any troubleshooting steps, commands, or explainations outside of the provided context.
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
        ],
        
        "retrieved_context": runbook_context + "\n\n" + command_context + "\n\n" + historical_context
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
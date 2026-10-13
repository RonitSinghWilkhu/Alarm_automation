from dotenv import load_dotenv
import os
import pickle
import hashlib
import json
import re
import uuid

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain_core.documents import Document
from FlagEmbedding import FlagReranker

from backend.database import SessionLocal
from backend.models import KnowledgeDocument, HistoricalIncident

load_dotenv()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Persistent FAISS index location (kept outside of source tree)
FAISS_INDEX_DIR = os.path.join(BASE_DIR, "data", "faiss_index")
PARENT_STORE_FILE = os.path.join(FAISS_INDEX_DIR, "parent_store.pkl")
FINGERPRINT_FILE = os.path.join(FAISS_INDEX_DIR, "fingerprint.json")

# ---------------------------------------------------------------------------
# Lazy-loaded singletons. None until first use.
# ---------------------------------------------------------------------------
_llm = None
_reranker = None
_embeddings = None
_vector_store = None


def _get_llm():
    """Create the ChatGroq client once, on first use."""
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            model="openai/gpt-oss-20b",
            temperature=0,
        )
    return _llm


def _get_reranker():
    """Create the FlagReranker client once, on first use."""
    global _reranker
    if _reranker is None:
        _reranker = FlagReranker(
            "BAAI/bge-reranker-v2-m3",
            use_fp16=False,
        )
    return _reranker


def _get_embeddings():
    """Create the HuggingFaceEmbeddings client once, on first use."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="BAAI/bge-large-en-v1.5",
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


# ---------------------------------------------------------------------------
# Alarm-type detection (used as a fallback when DB records lack alarm_type)
# ---------------------------------------------------------------------------
ALARM_PATTERNS = {
    "HIGH_CPU": re.compile(
        r"\bHIGH[_\s-]*CPU\b|\bCPU[_\s-]*(HIGH|UTILIZATION)\b", re.IGNORECASE
    ),
    "POWER_FAILURE": re.compile(
        r"\bPOWER[_\s-]*(FAILURE|FAIL|LOSS)\b", re.IGNORECASE
    ),
    "HIGH_TEMPERATURE": re.compile(
        r"\b(HIGH[_\s-]*TEMP|TEMPERATURE[_\s-]*HIGH|OVERHEAT|OVER[_\s-]*TEMP)\b",
        re.IGNORECASE,
    ),
    "S1_LINK_DOWN": re.compile(
        r"\bS1[_\s-]*LINK[_\s-]*DOWN\b|\bS1[_\s-]*DOWN\b", re.IGNORECASE
    ),
    "VSWR_HIGH": re.compile(
        r"\bVSWR[_\s-]*(HIGH|ALARM)\b|\bHIGH[_\s-]*VSWR\b", re.IGNORECASE
    ),
    "CELL_UNAVAILABLE": re.compile(
        r"\bCELL[_\s-]*(UNAVAILABLE|DOWN|OUTAGE)\b", re.IGNORECASE
    ),
}

def detect_alarm_type(content):
    """Uses regex to detect alarm types, handling case variations and formatting."""
    for alarm_type, pattern in ALARM_PATTERNS.items():
        if pattern.search(content):
            return alarm_type
    return "GENERAL"


# ---------------------------------------------------------------------------
# Index fingerprinting (invalidation mechanism)
# ---------------------------------------------------------------------------
def _compute_fingerprint(db):
    """Compute a SHA-256 fingerprint over all knowledge records.

    The fingerprint covers additions, deletions, and content updates for both
    KnowledgeDocument and HistoricalIncident rows. It is cheap to compute
    (single sequential scan) and is used to decide whether the persisted FAISS
    index is still valid.
    """
    hasher = hashlib.sha256()

    knowledge_records = (
        db.query(KnowledgeDocument).order_by(KnowledgeDocument.id).all()
    )
    for r in knowledge_records:
        hasher.update(
            f"K:{r.id}:{r.source_type}:{r.content}".encode("utf-8")
        )

    incident_records = (
        db.query(HistoricalIncident).order_by(HistoricalIncident.id).all()
    )
    for r in incident_records:

        hasher.update(
            (
                f"I:{r.id}:{r.ticket_id}:{r.alarm_type}:"
                f"{r.observed_symptoms or ''}:"
                f"{r.root_cause or ''}:"
                f"{r.actions_taken or ''}:"
                f"{r.shell_commands_used or ''}:"
                f"{r.shell_script_used or ''}:"
                f"{r.resolution or ''}:"
                f"{r.verification_results or ''}:"
                f"{r.escalation or ''}:"
                f"{r.additional_notes or ''}:"
                f"{r.source or ''}"
            ).encode("utf-8")
        )

    return hasher.hexdigest()


def _index_files_exist():
    """Return True only when every required persistence file is present."""
    return (
        os.path.isdir(FAISS_INDEX_DIR)
        and os.path.isfile(PARENT_STORE_FILE)
        and os.path.isfile(FINGERPRINT_FILE)
        # FAISS.save_local writes index.faiss + index.pkl by default
        and os.path.isfile(os.path.join(FAISS_INDEX_DIR, "index.faiss"))
        and os.path.isfile(os.path.join(FAISS_INDEX_DIR, "index.pkl"))
    )


def _load_saved_fingerprint():
    """Return the stored fingerprint string, or None on any failure."""
    try:
        with open(FINGERPRINT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        fp = data.get("fingerprint")
        return fp if isinstance(fp, str) else None
    except (OSError, json.JSONDecodeError, ValueError):
        return None


def _save_fingerprint(fingerprint):
    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    with open(FINGERPRINT_FILE, "w", encoding="utf-8") as f:
        json.dump({"fingerprint": fingerprint}, f)


# ---------------------------------------------------------------------------
# Vector store construction + persistence
# ---------------------------------------------------------------------------
def _build_vector_store():
    """Load knowledge from PostgreSQL, chunk, tag metadata, and build the FAISS
    index once. The index and parent store are persisted to disk and reused
    across process restarts as long as the database fingerprint matches.
    """
    global _vector_store
    if _vector_store is not None:
        return _vector_store

    embeddings = _get_embeddings()

    db = SessionLocal()
    try:
        current_fingerprint = _compute_fingerprint(db)

        # ------------------------------------------------------------------
        # Fast path: reuse the persisted index when the KB has not changed.
        # ------------------------------------------------------------------
        if (
            _index_files_exist()
            and _load_saved_fingerprint() == current_fingerprint
        ):
            try:
                # NOTE: FAISS.load_local uses pickle internally. We only load
                # files that this application itself wrote to FAISS_INDEX_DIR,
                # so enabling dangerous deserialization is acceptable here.
                vectorstore = FAISS.load_local(
                    FAISS_INDEX_DIR,
                    embeddings,
                    allow_dangerous_deserialization=True,
                )
                with open(PARENT_STORE_FILE, "rb") as f:
                    parent_store = pickle.load(f)

                _vector_store = {
                    "vectorstore": vectorstore,
                    "parent_store": parent_store,
                }
                return _vector_store
            except Exception:
                # Corrupt / incompatible persisted index -> fall through and
                # rebuild from PostgreSQL (the source of truth).
                pass

        # ------------------------------------------------------------------
        # Slow path: build from PostgreSQL.
        # ------------------------------------------------------------------
        knowledge_records = (
            db.query(KnowledgeDocument)
            .order_by(KnowledgeDocument.id)
            .all()
        )
        incident_records = (
            db.query(HistoricalIncident)
            .order_by(HistoricalIncident.id)
            .all()
        )

        # Build parent documents with reliable, explicit metadata.
        runbook_documents = []
        command_documents = []
        for record in knowledge_records:
            doc = Document(
                page_content=record.content,
                metadata={
                    "source_type": record.source_type,
                    "alarm_type": detect_alarm_type(record.content),
                },
            )
            if record.source_type == "runbook":
                runbook_documents.append(doc)
            elif record.source_type == "commands":
                command_documents.append(doc)
            # Any other source_type is ignored for vector indexing.

        historical_documents = []
        for record in incident_records:
            # Prefer the alarm_type stored in PostgreSQL; fall back to regex
            # detection only when the DB column is empty / None.
            alarm_type = (record.alarm_type or "").strip()
            if not alarm_type:
                alarm_type = detect_alarm_type(
                    f"{record.observed_symptoms or ''} "
                    f"{record.actions_taken or ''} "
                    f"{record.resolution or ''}"
                )


        content = (
            f"HISTORICAL INCIDENT: {record.id}\n\n"
            f"ALARM_TYPE: {alarm_type}\n\n"
            f"OBSERVED_SYMPTOMS:\n"
            f"{record.observed_symptoms or ''}\n\n"
            f"ROOT_CAUSE:\n"
            f"{record.root_cause or ''}\n\n"
            f"ACTIONS_TAKEN:\n"
            f"{record.actions_taken or ''}\n\n"
            f"SHELL_COMMANDS_USED:\n"
            f"{record.shell_commands_used or ''}\n\n"
            f"SHELL_SCRIPT_USED:\n"
            f"{record.shell_script_used or ''}\n\n"
            f"RESOLUTION:\n"
            f"{record.resolution or ''}\n\n"
            f"VERIFICATION_RESULTS:\n"
            f"{record.verification_results or ''}\n\n"
            f"ESCALATION:\n"
            f"{record.escalation or ''}\n\n"
            f"ADDITIONAL_NOTES:\n"
            f"{record.additional_notes or ''}"
        )

        historical_documents.append(
                Document(
                    page_content=content,
                    metadata={
                        "source_type": "historical",
                        "alarm_type": alarm_type,
                    },
                )
            )

        # Parents are the per-block chunks (split on the delimiter).
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
                                metadata=doc.metadata.copy(),
                            )
                        )
            return blocks

        runbook_chunks = split_into_blocks(runbook_documents)
        command_chunks = split_into_blocks(command_documents)
        historical_chunks = split_into_blocks(historical_documents)

        parents = runbook_chunks + command_chunks + historical_chunks

        # Assign a stable parent_id to every parent block. Metadata
        # (source_type, alarm_type) was already set at Document creation time
        # and is preserved through the split.
        parent_store = {}
        for parent in parents:
            parent_id = str(uuid.uuid4())
            parent.metadata["parent_id"] = parent_id
            parent_store[parent_id] = parent

        # Split parents into smaller child documents for precise searching.
        child_splitter = RecursiveCharacterTextSplitter(
            chunk_size=400,
            chunk_overlap=50,
        )
        children = []
        for parent in parents:
            parent_id = parent.metadata["parent_id"]
            child_docs = child_splitter.split_documents([parent])
            for child in child_docs:
                # Explicitly copy the metadata the retriever will filter on.
                # RecursiveCharacterTextSplitter already copies metadata, but
                # we re-assign here so the contract is explicit and robust to
                # future splitter changes.
                child.metadata["parent_id"] = parent_id
                child.metadata["source_type"] = parent.metadata["source_type"]
                child.metadata["alarm_type"] = parent.metadata["alarm_type"]
                children.append(child)

        vectorstore = FAISS.from_documents(children, embeddings)

        # ------------------------------------------------------------------
        # Persist the freshly built index + parent store + fingerprint.
        # ------------------------------------------------------------------
        try:
            os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
            vectorstore.save_local(FAISS_INDEX_DIR)
            with open(PARENT_STORE_FILE, "wb") as f:
                pickle.dump(parent_store, f)
            _save_fingerprint(current_fingerprint)
        except Exception:
            # Persistence is best-effort: the in-memory index is still valid
            # for this process. Future restarts will simply rebuild.
            pass

        _vector_store = {
            "vectorstore": vectorstore,
            "parent_store": parent_store,
        }
        return _vector_store

    finally:
        db.close()


def refresh_vector_store():
    """Refresh the in-memory RAG index from the current PostgreSQL data."""
    global _vector_store

    _vector_store = None
    return _build_vector_store()

# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------
def _search_and_fetch_parents(
    vectorstore, parent_store, query, k, filter_dict, fetch_k=20
):
    """Search for child chunks using MMR for diversity, rerank, and return
    the full parent documents. Safe against empty results, single-score
    reranker outputs, missing parent metadata, and missing parent entries.
    """
    reranker = _get_reranker()

    try:
        child_results = vectorstore.max_marginal_relevance_search(
            query,
            k=fetch_k,
            fetch_k=fetch_k * 2,
            filter=filter_dict,
        )
    except Exception:
        return []

    if not child_results:
        return []

    pairs = [[query, child.page_content] for child in child_results]
    scores = reranker.compute_score(pairs, normalize=True)

    # FlagReranker may return a single float when given one pair; normalise
    # to a list so the zip below always works.
    if isinstance(scores, (int, float)):
        scores = [scores]
    if len(scores) != len(child_results):
        # Defensive: if the reranker output shape is unexpected, bail out
        # rather than silently mis-aligning scores and documents.
        return []

    scored_children = list(zip(scores, child_results))
    scored_children.sort(key=lambda x: x[0], reverse=True)

    parents_ids = set()
    parents = []
    for _,child in scored_children:
        p_id = child.metadata.get("parent_id") if child.metadata else None
        if not p_id or p_id in parents_ids or p_id not in parent_store:
            continue
        parents_ids.add(p_id)
        parents.append(parent_store[p_id])

        #return upto k unique parent documents, not k child chunks.
        if len(parents) >= k:
            break

    return parents


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def _get_latest_historical_incidents(alarm_type, limit=2):
    """Return the latest matching incidents in the ascending ID order."""
    db= SessionLocal()

    try:
        records=(
            db.query(HistoricalIncident)
            .filter(HistoricalIncident.alarm_type == alarm_type)
            .order_by(HistoricalIncident.id.desc())
            .limit(limit)
            .all()
        )

        #the query selects newest first; display oldest first
        records.reverse()

        incidents = []

        for record in records:
            content = (
                f"HISTORICAL INCIDENT: {record.id}\n\n"
                f"ALARM_TYPE: {record.alarm_type}\n\n"
                f"OBSERVED_SYMPTOMS:\n"
                f"{record.observed_symptoms or ''}\n\n"
                f"ROOT_CAUSE:\n"
                f"{record.root_cause or ''}\n\n"
                f"ACTIONS_TAKEN:\n"
                f"{record.actions_taken or ''}\n\n"
                f"SHELL_COMMANDS_USED:\n"
                f"{record.shell_commands_used or ''}\n\n"
                f"SHELL_SCRIPT_USED:\n"
                f"{record.shell_script_used or ''}\n\n"
                f"RESOLUTION:\n"
                f"{record.resolution or ''}\n\n"
                f"VERIFICATION_RESULTS:\n"
                f"{record.verification_results or ''}\n\n"
                f"ESCALATION:\n"
                f"{record.escalation or ''}\n\n"
                f"ADDITIONAL_NOTES:\n"
                f"{record.additional_notes or ''}"
            )

            incidents.append(
                Document(
                    page_content=content,
                    metadata={
                        "source_type": "historical",
                        "alarm_type": record.alarm_type,
                        "incident_id": record.id,
                    },
                )
            )
        return incidents

    finally:
        db.close()


def troubleshoot_alarm(
    alarm_type,
    node,
    occurrence_count,
    users_impacted,
    severity,
    threshold_breached,
    impact_level,
    priority,
    assigned_team,
):
    pipeline = _build_vector_store()
    vectorstore = pipeline["vectorstore"]
    parent_store = pipeline["parent_store"]
    llm = _get_llm()

    query = "How do I troubleshoot " + alarm_type + "?"

    # --- Runbooks: alarm-scoped first, then fallback to any runbook. -------
    runbook_results = _search_and_fetch_parents(
        vectorstore,
        parent_store,
        query,
        k=2,
        filter_dict={"source_type": "runbook", "alarm_type": alarm_type},
    )
    if not runbook_results:
        runbook_results = _search_and_fetch_parents(
            vectorstore,
            parent_store,
            query,
            k=2,
            filter_dict={"source_type": "runbook"},
        )

    # --- Diagnostic commands: alarm-scoped, with the same fallback. --------
    command_results = _search_and_fetch_parents(
        vectorstore,
        parent_store,
        query,
        k=2,
        filter_dict={"source_type": "commands", "alarm_type": alarm_type},
    )
    if not command_results:
        command_results = _search_and_fetch_parents(
            vectorstore,
            parent_store,
            query,
            k=2,
            filter_dict={"source_type": "commands"},
        )

    #---Historical incidents: retrieve the latest two from PostgreSQL. ---
    historical_results = _get_latest_historical_incidents(
        alarm_type,
        limit=2,
    )

    runbook_context = "\n\n".join(r.page_content for r in runbook_results)
    command_context = "\n\n".join(r.page_content for r in command_results)
    historical_context = "\n\n".join(r.page_content for r in historical_results)

    if not runbook_context and not command_context and not historical_context:
        return {
            "recommendation": (
                "No relevant troubleshooting knowledge was found for alarm type '"
                + alarm_type
                + "'. Please verify the alarm type or update the knowledge base."
            ),
            "historicalIncidents": [],
            "retrieved_context": "",
        }

    prompt = f"""You are a telecom operations troubleshooting assistant.
Use the retrieved knowledge to help an operator troubleshoot the following ticket.

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

Provide the following sections in order:
1. What the alarm indicates
2. Why this ticket may require attention based on the ticket information
3. Recommended troubleshooting steps
4. Relevant diagnostic commands
5. Escalation recommendation

FORMATTING RULES:
- Use numbered lists for troubleshooting steps.
- Give the commands step-wise like - step 1 and so on.
- Use bullet points for diagnostic commands.
- For each command, write the command followed by a short explanation.
- Do NOT use Markdown tables.
- Do NOT use table formatting with | characters.
- Do NOT repeat any section.
- Keep the response concise and operational.

STRICT KNOWLEDGE RULES:
- Use the retrieved runbook, relevant diagnostic commands, historical incidents, and ticket information as your only sources.
- Recommend only troubleshooting steps explicitly supported by the retrieved runbook or historical incidents.
- Recommend only shell commands explicitly present in the retrieved diagnostic commands or relevant historical incidents.
- Do not introduce commands, recovery actions, or operational procedures from general knowledge.
- If the retrieved knowledge does not support a troubleshooting step, do not recommend that step.
- Never invent, modify, or combine shell commands.
- Never introduce undocumented recovery actions.
- Never automatically execute commands.
- Preserve all conditions and cautions in the runbook exactly as written.
- Never turn a conditional recovery action into an unconditional instruction.
- Clearly state when an action requires operational approval.
- Treat historical incidents as supporting evidence, not guaranteed solutions.
- Do not treat a historical resolution as automatically correct for the current ticket.
- Use the current ticket information together with the runbook and historical incident information.
- If a historical incident contains a shell command, only recommend it if it is relevant to the current alarm.
- Do not fill gaps with general knowledge.

CRITICAL RULE FOR HALLUCINATION PREVENTION:
If the retrieved knowledge is insufficient to accurately answer the query or provide troubleshooting steps, you must explicitly state: "Insufficient data in the knowledge base to resolve this issue."
Do not guess, assume, or invent any troubleshooting steps, commands, or explanations outside of the provided context.
"""

    response = llm.invoke(prompt)

    return {
        "recommendation": response.content,
        "historicalIncidents": [
            {
                "id": result.metadata["incident_id"],
                "content": result.page_content,
                "alarmType": result.metadata.get("alarm_type"),
            }
            for result in historical_results
        ],
        "retrieved_context": (
            runbook_context + "\n\n" + command_context + "\n\n" + historical_context
        ),
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
        "Platform",
    )
    print("\n--- TROUBLESHOOTING RESULT ---")
    print(result)
# Alarm Automation — RAG Documentation

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [RAG Architecture Overview](#2-rag-architecture-overview)
3. [Knowledge Sources](#3-knowledge-sources)
4. [Document Construction & Metadata Contract](#4-document-construction--metadata-contract)
5. [Parent–Child Chunking Strategy](#5-parentchild-chunking-strategy)
6. [Embeddings](#6-embeddings)
7. [Vector Store Persistence & Fingerprinting](#7-vector-store-persistence--fingerprinting)
8. [Vector Store Refresh (Closed-Loop Learning)](#8-vector-store-refresh-closed-loop-learning)
9. [Retrieval Pipeline](#9-retrieval-pipeline)
10. [Historical Incident Retrieval](#10-historical-incident-retrieval)
11. [Troubleshooting Generation](#11-troubleshooting-generation)
12. [Root Cause Analysis (RCA) Pipeline](#12-root-cause-analysis-rca-pipeline)
13. [RAG Evaluation](#13-rag-evaluation)
14. [Startup Lifecycle](#14-startup-lifecycle)
15. [Configuration Reference](#15-configuration-reference)
16. [AI Safety Principles](#16-ai-safety-principles)
17. [Current Limitations](#17-current-limitations)
18. [Changelog](#18-changelog)

---

## 1. Purpose

This document describes the Retrieval-Augmented Generation (RAG) subsystem that powers two operator-facing capabilities:

| Capability | Entry Point | Purpose |
|---|---|---|
| **AI Troubleshooting** | `GET /troubleshoot/{ticket_number}` | Recommend diagnostic steps for an active alarm |
| **AI Root Cause Analysis** | `GET /rca/{ticket_number}` | Investigate the likely root cause of a closed P1/P2 incident |

Both capabilities are **retrieval-grounded** and **human-in-the-loop**. The system produces recommendations and analysis; it never executes commands or mutates ticket state.

### 1.1 What Changed in v2.0

The RAG subsystem was substantially reworked:

- Knowledge moved from **plain text files** to **PostgreSQL tables**.
- The FAISS index and parent store are now **persisted to disk** and reused across restarts via a **database fingerprint**.
- Retrieval uses `source_type` and `alarm_type` filters. Historical retrieval also enforces those values again on resolved parent documents; runbook and command retrieval can fall back to source-type-only searches.
- Ticket closure now **writes back** into the knowledge base (closed-loop learning).
- A dedicated **RCA pipeline** was added with temporal correlation, evidence-gap tracking, and output validation.
- A **RAG evaluation** subsystem persists quality metrics to PostgreSQL.

---

## 2. RAG Architecture Overview

```text
                    PostgreSQL
                         |
        +----------------+----------------+
        |                                 |
        v                                 v
 knowledge_documents              historical_incidents
 (runbook / commands)             (migration / questionnaire)
        |                                 |
        +----------------+----------------+
                         |
                         v
              Document construction
           (explicit metadata tagging)
                         |
                         v
                Parent block splitting
                         |
                         v
              parent_id assignment (UUID)
                         |
                         v
                 parent_store { }
                         |
                         v
              Child chunking (400 / 50)
                         |
                         v
                  BGE Embeddings
                         |
                         v
                    FAISS index
                         |
        +----------------+----------------+
        |                                 |
        v                                 v
  Persisted to disk                 Held in memory
  (FAISS_INDEX_DIR +                (_vector_store)
   PARENT_STORE_FILE)                      |
                                           v
                              ┌────────────┴────────────┐
                              |                         |
                              v                         v
                    Troubleshooting                   RCA
                              |                         |
                              v                         v
                  MMR + metadata filter      MMR + metadata filter
                              |                         |
                              v                         v
                     Cross-encoder rerank      Cross-encoder rerank
                              |                         |
                              v                         v
                    Parent resolution          Parent resolution
                              |                         |
                              v                         v
                        Groq LLM                  Groq LLM
                              |                         |
                              v                         v
                    Recommendation              Structured RCA JSON
```

---

## 3. Knowledge Sources

The runtime knowledge base is **PostgreSQL**, not the file system. The legacy `knowledge/*.txt` files are now **migration inputs only**, consumed once by the root-level `migrate_knowledge.py`.

### 3.1 `knowledge_documents`

Queried at index-build time, ordered by `id`:

```python
knowledge_records = (
    db.query(KnowledgeDocument)
    .order_by(KnowledgeDocument.id)
    .all()
)
```

Only two `source_type` values are indexed:

| `source_type` | Content | Indexed |
|---|---|---|
| `runbook` | Troubleshooting procedures per alarm type | Yes |
| `commands` | Diagnostic shell-command references | Yes |
| *(any other)* | — | **Ignored** |

The code is explicit on this point:

```python
if record.source_type == "runbook":
    runbook_documents.append(doc)
elif record.source_type == "commands":
    command_documents.append(doc)
# Any other source_type is ignored for vector indexing.
```

### 3.2 `historical_incidents`

Queried separately, ordered by `id`:

```python
incident_records = (
    db.query(HistoricalIncident)
    .order_by(HistoricalIncident.id)
    .all()
)
```

Two provenance values exist:

| `source` | Origin |
|---|---|
| `migration` | Imported from legacy `historical_incidents.txt` |
| `questionnaire` | Captured from the operator resolution form on ticket closure |

Both are indexed identically — the pipeline does not privilege one over the other at retrieval time.

---

## 4. Document Construction & Metadata Contract

Metadata is assigned when each LangChain `Document` is created. The implementation differs between `knowledge_documents` and `historical_incidents`.

### 4.1 Runbook and Command Documents

For each `KnowledgeDocument`, `page_content` is taken from `record.content`. The metadata is:

```python
metadata={
    "source_type": record.source_type,
    "alarm_type": detect_alarm_type(record.content),
}
```

**Important correction:** `rag.py` does not use a stored `record.alarm_type` field for these knowledge documents. It detects the alarm type from the document content using the regular-expression patterns in `ALARM_PATTERNS`.

Only these `source_type` values are added to the index:
- `runbook`
- `commands`

Other source types are ignored by the indexing code.

### 4.2 Historical Incident Documents

Historical incidents use the stored `record.alarm_type` when it is non-empty. If it is empty or whitespace, the code calls `detect_alarm_type()` using a concatenation of:
- `observed_symptoms`
- `root_cause`
- `actions_taken`
- `resolution`

The historical document is flattened into labelled text. Its content includes the incident ID, alarm type, observed symptoms, root cause, actions taken, shell commands, shell script, resolution, verification results, escalation, and additional notes.

Its metadata is:

```python
metadata={
    "source_type": "historical",
    "alarm_type": alarm_type,
    "incident_id": record.id,
}
```

### 4.3 Metadata Contract

| Key | Values | Purpose |
|---|---|---|
| `source_type` | `runbook`, `commands`, `historical` | Selects the retrieval corpus |
| `alarm_type` | Detected or stored alarm type | Alarm-specific retrieval filter |
| `parent_id` | UUID4 string | Connects each child chunk to its parent block |
| `incident_id` | Integer | Identifies the originating historical incident; historical documents only |

`source_type`, `alarm_type`, and `incident_id` are attached at document construction. `parent_id` is assigned later, after parent blocks have been split.

---

## 5. Parent–Child Chunking Strategy

The index uses two levels of text:

- **Parent blocks** preserve a larger logical unit of source knowledge for LLM context.
- **Child chunks** are smaller units embedded and searched for retrieval precision.

### 5.1 Parent block splitting

`split_into_blocks()` is defined locally inside `_build_vector_store()`.

```python
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
```

**Exact parent delimiter:** 50 hyphen characters:

```text
--------------------------------------------------
```

Each source document is split wherever this exact delimiter occurs. Leading and trailing whitespace is removed from each resulting block, and empty blocks are discarded.

**There is no parent character-size limit in this function.** Parent size is determined by the source content between delimiter occurrences. Do not describe parent blocks as having a fixed token or character size.

The function is applied separately to runbook, command, and historical documents. The resulting parent lists are concatenated.

### 5.2 Parent identity and parent store

Each parent block receives a newly generated UUID4 string:

```python
parent_id = str(uuid.uuid4())
parent.metadata["parent_id"] = parent_id
parent_store[parent_id] = parent
```

The in-memory parent store is a dictionary mapping `parent_id` to the complete parent `Document`.

The IDs are generated during index construction; they are not stable database identifiers across a rebuild.

### 5.3 Child chunking

Each parent is split using `RecursiveCharacterTextSplitter`:

```python
child_splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,
    chunk_overlap=50,
)
```

Thus:
- child chunk size is 400 characters;
- overlap between adjacent child chunks is 50 characters.

The code explicitly copies `parent_id`, `source_type`, and `alarm_type` from the parent onto each child. This ensures the metadata required for filtering and parent resolution is present on the embedded child documents.

### 5.4 Retrieval relationship

```text
Source Document
      |
      v
Split on exact 50-hyphen delimiter
      |
      v
Parent blocks (no fixed parent size)
      |
      +---- UUID parent_id -> parent_store
      |
      v
Split each parent into 400-character children
with 50-character overlap
      |
      v
Embed children in FAISS
```

A child is the retrieval unit. The corresponding full parent block is the context unit returned to the generation pipeline.

---

## 6. Embeddings

| Property | Value |
|---|---|
| Model | `BAAI/bge-large-en-v1.5` |
| Provider | Hugging Face embeddings |
| Normalization | Enabled before FAISS insertion |
| Index | FAISS (local, persisted) |

Normalization means FAISS inner-product search behaves as cosine similarity.

---

## 7. Vector Store Persistence & Fingerprinting

The FAISS index, parent store, and database fingerprint are persisted under:

```python
FAISS_INDEX_DIR = os.path.join(BASE_DIR, "data", "faiss_index")
PARENT_STORE_FILE = os.path.join(FAISS_INDEX_DIR, "parent_store.pkl")
FINGERPRINT_FILE = os.path.join(FAISS_INDEX_DIR, "fingerprint.json")
```

### 7.1 Exact fingerprint mechanism

The fingerprint is a **SHA-256 hash over serialized values from all indexed-source database rows**. It is not a row-count-plus-maximum-`updated_at` shortcut.

The implementation starts with a version marker:

```python
hasher = hashlib.sha256()
hasher.update(b"historical_alarm_type_filter_v2")
```

It then queries all `KnowledgeDocument` rows ordered by `id`. For each row, it hashes this formatted string:

```python
f"K:{r.id}:{r.source_type}:{r.content}"
```

Next, it queries all `HistoricalIncident` rows ordered by `id`. For each row, it hashes these values, in this order:

```python
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
)
```

Each formatted row string is encoded as UTF-8 and fed into the same SHA-256 hasher. `_compute_fingerprint()` returns `hasher.hexdigest()`.

Consequences:
- additions and deletions change the fingerprint;
- changes to the included content or metadata fields change the fingerprint;
- row ordering is deterministic because both queries are ordered by `id`;
- `updated_at` is not part of the fingerprint;
- fields not listed above do not directly affect the fingerprint;
- the leading version marker invalidates fingerprints when that marker is changed in code.

### 7.2 Build-or-load behavior

`_build_vector_store()` first returns the in-memory `_vector_store` if it has already been initialized in the current process.

Otherwise, it computes the current database fingerprint and checks that all required artifacts exist:
- the FAISS index directory;
- `parent_store.pkl`;
- `fingerprint.json`;
- `index.faiss`;
- `index.pkl`.

If the artifacts exist and the stored fingerprint matches, the function attempts to load the FAISS index and pickle parent store. If loading fails, it falls through to a rebuild from PostgreSQL.

If the fingerprint differs or the artifacts are missing, it rebuilds the documents, parents, children, embeddings, and FAISS index from PostgreSQL.

### 7.3 Persistence artifacts

| Artifact | Constant / path | Contents |
|---|---|---|
| FAISS directory | `FAISS_INDEX_DIR` | FAISS serialized index files |
| Parent store | `PARENT_STORE_FILE` | Pickled `{parent_id: Document}` mapping |
| Fingerprint | `FINGERPRINT_FILE` | JSON object containing the fingerprint string |

The fingerprint file has this structure:

```json
{
  "fingerprint": "..."
}
```

### 7.4 Deserialization security

Both `FAISS.load_local(..., allow_dangerous_deserialization=True)` and `pickle.load()` deserialize trusted local artifacts.

These paths must be writable only by the application or another trusted deployment process. Do not load files supplied by untrusted users or external sources.

### 7.5 Persistence is best-effort

When a newly built index is ready, the code attempts to save the FAISS index, parent store, and fingerprint. Exceptions during persistence are swallowed: the in-memory index is still returned for the current process, and a later process restart may rebuild the index.

### 7.6 Returned pipeline object

The function caches and returns:

```python
{
    "vectorstore": vectorstore,
    "parent_store": parent_store,
}
```

---

## 8. Vector Store Refresh (Closed-Loop Learning)

Persistence introduces a staleness problem: new knowledge written to PostgreSQL would not appear in a cached index. This is solved by an explicit refresh hook.

### 8.1 Trigger

The earlier project documentation states that the ticket-close endpoint calls `refresh_vector_store()` **after** a resolution questionnaire is committed. The uploaded verification set for this revision did not include the ticket-close route in `backend/main.py`, so the route call order below is retained from the existing documentation and is not independently re-verified here:

```text
PUT /tickets/{n}/close  (with resolution body)
        |
        v
Create HistoricalIncident (source = "questionnaire")
        |
        v
Set ticket CLOSED, create TICKET_CLOSED event
        |
        v
db.commit()
        |
        v
refresh_vector_store()
        |
        v
Index + parent store rebuilt and re-persisted
        |
        v
New incident retrievable by /troubleshoot and /rca
```

### 8.2 Significance

This closes the operational knowledge loop:

```text
Alarm raised
     |
     v
Operator troubleshoots (RAG-assisted)
     |
     v
Operator resolves and documents
     |
     v
Knowledge base grows
     |
     v
Next similar alarm retrieves this resolution
```

Operator-submitted resolution records can become searchable historical evidence after the refresh. Retrieval quality still depends on the completeness and accuracy of those records.

---

## 9. Retrieval Pipeline

All three retrieval categories use `_search_and_fetch_parents()`:
- runbooks;
- diagnostic commands;
- historical incidents.

### 9.1 Function defaults and MMR candidate retrieval

The function signature is:

```python
def _search_and_fetch_parents(
    vectorstore,
    parent_store,
    query,
    k,
    filter_dict,
    fetch_k=20,
):
```

The default `fetch_k` is **20**.

The FAISS MMR call is:

```python
child_results = vectorstore.max_marginal_relevance_search(
    query,
    k=fetch_k,
    fetch_k=fetch_k * 2,
    filter=filter_dict,
)
```

With the default:
- `fetch_k` argument supplied to the helper: 20;
- MMR `k`: 20 child documents returned;
- MMR candidate pool `fetch_k`: 40 candidates before MMR selection.

The metadata filter is applied inside the vector-store search.

### 9.2 Cross-encoder reranking

Every child returned by MMR is paired with the query and scored by:

```python
scores = reranker.compute_score(pairs, normalize=True)
```

The reranker is `BAAI/bge-reranker-v2-m3`, loaded through `FlagReranker` with `use_fp16=False`.

The code handles a scalar score by wrapping it in a list. If the number of scores does not match the number of child documents, retrieval returns an empty list rather than pairing misaligned results.

The child documents are sorted by reranker score in descending order.

### 9.3 Parent resolution and final top-N

After reranking, the code walks the sorted child results and:
1. reads each child's `parent_id`;
2. skips missing IDs;
3. skips parent IDs already returned;
4. skips IDs absent from `parent_store`;
5. appends the full parent document;
6. stops when it has collected `k` unique parents.

Therefore, **the final number of parent documents is controlled by the `k` argument to `_search_and_fetch_parents()`**, not by the number of child candidates. It can be lower than `k` if there are not enough valid unique parents.

### 9.4 Exact retrieval parameters by path

| Retrieval path | `k` (maximum unique parent blocks returned) | `fetch_k` passed to helper | MMR child results (`k`) | MMR candidate pool (`fetch_k`) |
|---|---:|---:|---:|---:|
| Runbooks, alarm-specific | 2 | Default 20 | 20 | 40 |
| Runbooks, fallback across alarm types | 2 | Default 20 | 20 | 40 |
| Commands, alarm-specific | 2 | Default 20 | 20 | 40 |
| Commands, fallback across alarm types | 2 | Default 20 | 20 | 40 |
| Historical incidents for troubleshooting | 3 | Explicit 20 | 20 | 40 |
| Historical incidents for RCA | 5 | Explicit 20 | 20 | 40 |

The runbook and command calls do not specify `fetch_k`, so they use the helper's default of 20. The historical helper explicitly passes 20.

### 9.5 Full retrieval flow

```text
Query + metadata filter
        |
        v
MMR: 40-candidate pool -> up to 20 child results
        |
        v
Cross-encoder scores returned children
        |
        v
Sort children by score, descending
        |
        v
Resolve child parent_id values
        |
        v
Deduplicate parent IDs
        |
        v
Return up to k unique parent documents
```

**Important distinction:** `fetch_k=20` is not the final LLM context count. The final parent count is limited by the per-call `k` values in the table above.

---

## 10. Historical Incident Retrieval

Historical incidents use a dedicated helper, `_get_relevant_historical_incidents()`.

### 10.1 Troubleshooting retrieval

For troubleshooting, the helper is called with `k=3` and `fetch_k=20`:

```python
_get_relevant_historical_incidents(
    query=historical_query,
    alarm_type=alarm_type,
    k=3,
)
```

The helper searches with this metadata filter:

```python
{
    "source_type": "historical",
    "alarm_type": alarm_type,
}
```

It then performs a second parent-level check. Only returned documents whose `source_type` is exactly `historical` and whose `alarm_type` equals `alarm_type.strip()` are retained.

### 10.2 RCA retrieval

RCA calls the same helper with `k=5`. The helper still passes `fetch_k=20` to `_search_and_fetch_parents()`.

### 10.3 Why the second filter exists

FAISS filters child metadata. After parent resolution, the code independently enforces the expected metadata on each returned parent. This provides an additional guard against returning a parent from the wrong source type or alarm type.

### 10.4 Historical evidence is not a confirmed diagnosis

Retrieved historical incidents are supporting evidence. Similar alarm types do not prove that the current incident has the same root cause.

---

## 11. Troubleshooting Generation

### 11.1 Function Signature

```python
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
    # ...
```

The function receives the ticket fields shown in its signature. These values are included in the prompt alongside the retrieved knowledge. The code does not independently calculate a severity or urgency score.

### 11.2 Context Assembly

| Context Source | Filter |
|---|---|
| Runbooks | First `source_type=runbook` plus matching `alarm_type`; if no parent is returned, retry with `source_type=runbook` only |
| Diagnostic commands | First `source_type=commands` plus matching `alarm_type`; if no parent is returned, retry with `source_type=commands` only |
| Historical incidents | `source_type=historical` plus matching `alarm_type`; no cross-alarm fallback, with parent-level enforcement |

### 11.3 LLM Configuration

| Property | Value |
|---|---|
| Provider | Groq (via `ChatGroq`) |
| Model | `openai/gpt-oss-20b` |
| Temperature | `0` |

Temperature 0 is deliberate — troubleshooting guidance must be reproducible. The same alarm state should not yield different command sequences across runs.

### 11.4 Response Shape

```json
{
  "alarmType": "HIGH_CPU",
  "recommendation": "...",
  "historicalIncidents": []
}
```

The function's returned dictionary includes `retrieved_context` for internal evaluation use, in addition to `recommendation` and `historicalIncidents`. Whether the API route removes that field before returning its HTTP response must be checked in the route implementation.

### 11.5 Error Handling

The endpoint logs the internal exception and returns a generic message:

```json
{
  "detail": "Troubleshooting failed. Please try again later."
}
```

Internal exception details, stack traces, and knowledge-base content are never leaked to the client.

---

## 12. Root Cause Analysis (RCA) Pipeline

RCA is implemented separately in `backend/rca.py`. It combines:
- up to five retrieved historical parent documents for the same alarm type;
- the current ticket's latest linked `HistoricalIncident`, when one exists;
- same-node temporal ticket observations within a 30-minute window;
- an LLM-generated structured analysis.

RCA does not execute commands or modify ticket/network state.

### 12.1 Historical retrieval

RCA calls `_get_relevant_historical_incidents(..., k=5)`. That helper uses:
- `source_type=historical`;
- exact `alarm_type` filtering;
- `fetch_k=20` in the shared retrieval helper;
- reranking and parent resolution;
- a second parent-level metadata check.

The final historical context contains up to five unique parent documents.

### 12.2 Current ticket and recorded resolution

RCA looks up the current `Ticket` by `ticket_number`, obtains its `created_at`, and finds the latest `HistoricalIncident` linked by `ticket_id`, ordered by `created_at` descending.

If a linked incident exists, the prompt receives its recorded:
- root cause;
- actions taken;
- resolution;
- verification results;
- shell commands;
- shell script;
- escalation;
- additional notes.

Missing fields are represented in the prompt as `"Not documented"`.

If no linked incident exists, the prompt explicitly says that no `HistoricalIncident` is linked and that the resolution details are unavailable. The model is instructed not to invent them.

### 12.3 Resolution evidence gaps

The code creates `resolution_evidence_gaps` as follows:

- If there is no linked `HistoricalIncident`, it adds: `No recorded resolution is linked to the current ticket.`
- If there is a linked incident, it checks only these four fields for empty or whitespace-only values:
  - `root_cause`
  - `actions_taken`
  - `resolution`
  - `verification_results`

It does not add systematic missing-field gaps for shell commands, shell script, escalation, or additional notes.

After parsing the model result, the code merges the model's `evidenceGaps` list with these system-detected gaps using `dict.fromkeys()`. This removes duplicate values while preserving their first-seen order.

### 12.4 Same-node temporal correlation

`get_related_tickets()`:
- looks up the current ticket by ticket number;
- returns an empty list if the ticket or its `created_at` is unavailable;
- defines a time range from 30 minutes before to 30 minutes after the current ticket's creation time;
- selects other tickets on the supplied same node;
- excludes the current ticket number;
- excludes tickets whose `alarm_type` equals the current alarm type;
- orders matches by `created_at` ascending.

Each related-ticket object contains:

```json
{
  "ticketNumber": "...",
  "node": "...",
  "alarmType": "...",
  "severity": "...",
  "status": "...",
  "createdAt": "...",
  "occurrenceCount": 0,
  "usersImpacted": 0,
  "priority": "..."
}
```

`build_correlation_findings()` creates one finding when the current ticket timestamp is available. It reports the observed alarm types, nodes, ticket numbers, time span, configured window, and:

```json
{
  "evidenceType": "temporal_and_node_correlation",
  "causationEstablished": false
}
```

This is descriptive temporal/node correlation, not causal proof. The helper's docstring explicitly says the relationships do not establish causation.

### 12.5 Prompt constraints

The RCA prompt tells the model to:
- distinguish current-ticket facts from historical evidence;
- avoid treating matching alarm types as proof of a shared cause;
- avoid inventing root causes, checks, commands, or verification results;
- use related tickets as observations rather than proof;
- keep documented root cause, probable root cause, actions, resolution, and verification conceptually separate;
- return `null` for `probableRootCause` and `low` confidence when evidence is insufficient;
- use only documented checks from retrieved historical incidents for `recommendedValidation`.

### 12.6 Exact LLM JSON schema

The prompt requests a JSON object with these eight keys:

```json
{
  "status": "probable_cause_identified",
  "probableRootCause": "explanation or null",
  "confidence": "low",
  "supportingEvidence": [
    {
      "source": "historical incident ID or ticket information",
      "evidence": "specific documented evidence",
      "relevance": "why the evidence supports or limits the hypothesis"
    }
  ],
  "alternativeHypotheses": [
    {
      "hypothesis": "possible cause",
      "evidence": "documented evidence supporting it"
    }
  ],
  "evidenceGaps": [
    "specific missing information"
  ],
  "recommendedValidation": [
    {
      "check": "documented diagnostic check",
      "purpose": "purpose supported by retrieved evidence"
    }
  ],
  "summary": "concise RCA conclusion"
}
```

Allowed `status` values are:
- `probable_cause_identified`
- `insufficient_evidence`

Allowed `confidence` values are:
- `low`
- `medium`
- `high`

### 12.7 What the validator actually checks

The validator in `rca.py` is a **basic structural and enum validator**, not a JSON Schema validator and not a grounding validator.

It performs these checks:

1. Parses `response.content` using `json.loads()`. Markdown fences or explanatory text outside JSON will cause parsing to fail.
2. Requires the parsed value to be a Python dictionary.
3. Checks that the dictionary contains these required keys:
   - `status`
   - `probableRootCause`
   - `confidence`
   - `supportingEvidence`
   - `alternativeHypotheses`
   - `evidenceGaps`
   - `recommendedValidation`
   - `summary`
4. Checks that `status` is one of the two allowed values.
5. Checks that `confidence` is `low`, `medium`, or `high`.
6. Checks that if `status` is `insufficient_evidence`, `probableRootCause` must be `None`.

It does **not**:
- enforce an exact-key schema; extra keys are accepted;
- validate the types or item structures of the arrays;
- require `probableRootCause` to be a string when a cause is identified;
- check consistency between `status` and the other fields beyond the insufficient-evidence/null rule;
- verify that evidence citations or claims exist in retrieved documents;
- independently test whether the root cause is grounded;
- verify that recommended checks are present in the historical context.

Grounding is encouraged by the prompt instructions, but it is not programmatically verified by this validator. A syntactically valid, structurally accepted response can still contain unsupported claims.

On JSON parsing or validation failure, the function returns a fallback with `status="insufficient_evidence"`, `probableRootCause=None`, `confidence="low"`, empty evidence/validation arrays, and a message stating that no root cause has been asserted.

### 12.8 Complete function response shape

On the normal successful path, the function returns an outer object containing:

| Key | Origin / meaning |
|---|---|
| `ticketNumber` | Current ticket number passed to the function |
| `alarmType` | Current alarm type passed to the function |
| `status` | LLM result status |
| `probableRootCause` | LLM result; string or `null` |
| `confidence` | LLM result confidence |
| `supportingEvidence` | LLM result array |
| `alternativeHypotheses` | LLM result array |
| `evidenceGaps` | LLM gaps merged with system-detected resolution gaps |
| `recommendedValidation` | LLM result array |
| `summary` | LLM result summary |
| `recordedResolution` | Current linked incident fields, or `null` values when no incident exists |
| `historicalIncidents` | Retrieved historical documents with `id`, `alarmType`, and `content` |
| `relatedTickets` | Same-node, different-alarm tickets in the time window |
| `correlationFindings` | Deterministic correlation finding list |

The `recordedResolution` object contains:

```json
{
  "rootCause": null,
  "actionsTaken": null,
  "resolution": null,
  "verificationResults": null,
  "shellCommandsUsed": null,
  "shellScriptUsed": null,
  "escalation": null,
  "additionalNotes": null
}
```

The values above illustrate the no-linked-incident case. When a linked `HistoricalIncident` exists, each field is populated from that database record.

### 12.9 Early and fallback responses

There are three materially different response paths:

**A. Current ticket timestamp unavailable**

Returns:
- `ticketNumber`, `alarmType`;
- `status="insufficient_evidence"`;
- `probableRootCause=null`;
- `confidence="low"`;
- empty `supportingEvidence`, `alternativeHypotheses`, `recommendedValidation`, `historicalIncidents`, `relatedTickets`, and `correlationFindings`;
- an `evidenceGaps` message that the current ticket or creation timestamp was not found;
- a message that correlation analysis could not proceed.

**B. No historical context and no current linked resolution**

Returns an insufficient-evidence result with:
- no asserted root cause;
- empty supporting evidence and alternative hypotheses;
- evidence gaps indicating no relevant historical incidents and no current diagnostic evidence, plus any resolution gaps;
- any related tickets and correlation findings already computed;
- an explanatory message.

**C. JSON parsing or validation failure**

Returns an insufficient-evidence result with:
- no asserted root cause;
- a validation-failure evidence gap;
- the retrieved historical incidents;
- related tickets and correlation findings;
- a message that no root cause has been asserted.

The early and fallback objects do not all have exactly the same keys as the normal successful response. In particular, the early returns do not include the successful-path `recordedResolution` object.

### 12.10 RCA flow

```text
analyze_root_cause(...)
        |
        v
Build/load vector store and retrieve up to 5 historical parents
        |
        v
Load current ticket + latest linked HistoricalIncident
        |
        v
Is current ticket creation timestamp available?
        |
        +---- No ---> insufficient-evidence early response
        |
        v
Find same-node, different-alarm tickets within +/- 30 minutes
        |
        v
Build deterministic correlation findings
        |
        v
Build current resolution context + evidence gaps
        |
        v
Any historical context or linked current incident?
        |
        +---- No ---> insufficient-evidence fallback
        |
        v
Invoke Groq LLM with constrained JSON prompt
        |
        v
Parse JSON + basic structural/enum validation
        |
        +---- Invalid ---> validation-failure fallback
        |
        v
Merge system resolution gaps into model evidenceGaps
        |
        v
Return structured RCA result
```

**API eligibility note:** the ticket status/priority gate described in the earlier version is enforced outside this function, at the API route layer. The uploaded `rca.py` itself does not check whether the ticket is closed or whether its priority is P1/P2.

---

## 13. RAG Evaluation

The evaluation implementation is in `backend/evaluate.py`. It uses a fixed JSON dataset, executes the troubleshooting pipeline for each case, and asks a separate, larger LLM to judge the result against the expected ground truth.

### 13.1 Test-case source

The dataset path is constructed relative to the backend file:

```python
DATASET_PATH = os.path.join(
    os.path.dirname(__file__),
    "evaluation_dataset.json",
)
```

The file is therefore expected at:

```text
backend/evaluation_dataset.json
```

`load_dataset()`:
- raises `FileNotFoundError` if the dataset file does not exist;
- opens it as UTF-8;
- parses it using `json.load()`.

The evaluator expects each case to contain:

```json
{
  "scenario": {
    "alarm_type": "...",
    "node": "...",
    "occurrence_count": 0,
    "users_impacted": 0,
    "severity": "...",
    "threshold_breached": true,
    "impact_level": "...",
    "priority": "...",
    "assigned_team": "..."
  },
  "question": "Evaluation query text",
  "ground_truth": "Expected key actions or steps"
}
```

The `scenario` object must provide the keyword arguments accepted by `troubleshoot_alarm()` in `rag.py`: `alarm_type`, `node`, `occurrence_count`, `users_impacted`, `severity`, `threshold_breached`, `impact_level`, `priority`, and `assigned_team`. The other two values are used as the judge's user query and expected answer.

The uploaded `evaluate.py` does not generate test cases or derive ground truth automatically. Test-case content is maintained in `evaluation_dataset.json`.

### 13.2 RAG response inputs to the judge

For each dataset case, the evaluator:
1. calls `troubleshoot_alarm(**scenario)`;
2. reads `result["recommendation"]` as the generated response;
3. reads `result["retrieved_context"]` as the retrieved context;
4. reads `case["question"]` as the user query;
5. reads `case["ground_truth"]` as the expected reference content.

The judge prompt includes at most the first 1,500 characters of retrieved context:

```python
context[:1500]
```

The recommendation and ground truth are included in the prompt without that 1,500-character truncation.

### 13.3 LLM-as-a-judge

**Yes. The evaluator uses an LLM-as-a-judge.**

The judge is initialized as:

```python
JUDGE_MODEL = "openai/gpt-oss-120b"

judge_llm = ChatGroq(
    model=JUDGE_MODEL,
    temperature=0,
)
```

This is distinct from the troubleshooting generation model (`openai/gpt-oss-20b`) configured in `rag.py`.

The judge is instructed to score four metrics from 1 to 5:

| Metric | Judge's evaluation question |
|---|---|
| `context_precision` | Is the retrieved context relevant to the user query? |
| `faithfulness` | Did the generated answer use the context without hallucinating commands, steps, or facts? |
| `answer_relevancy` | Did the answer address the specific ticket details and user query? |
| `ground_truth_match` | Does the answer contain the key actions/steps in the expected ground truth? |

The prompt requests only a JSON object with these exact keys and integer scores:

```json
{
  "context_precision": 1,
  "faithfulness": 1,
  "answer_relevancy": 1,
  "ground_truth_match": 1
}
```

The values above are schema examples, not measured scores.

### 13.4 Judge response parsing and per-case details

The evaluator strips a leading ````json` fence and a trailing code fence if present, then calls `json.loads()`.

It does not perform a strict schema validation of the judge response. It uses `.get(metric, 0)` when accumulating each metric. Therefore:
- missing metric keys contribute zero;
- non-integer values are not explicitly rejected;
- values outside the requested 1–5 range are not explicitly rejected;
- malformed JSON causes that case's scoring attempt to be skipped;
- other per-case exceptions are caught and printed.

Only successfully parsed judge responses are appended to `detailed_results`. Each stored detail contains:

```json
{
  "alarm_type": "...",
  "scores": {
    "context_precision": 1,
    "faithfulness": 1,
    "answer_relevancy": 1,
    "ground_truth_match": 1
  }
}
```

### 13.5 Average and overall-score calculation

The code sets:

```python
num_cases = len(dataset)
```

Each metric total is divided by `num_cases`, rounded to two decimal places. The overall score is the arithmetic mean of the four average metric values:

```python
avg_scores["overall_score"] = round(
    sum(avg_scores.values()) / 4,
    2,
)
```

The division denominator is the **total dataset size**, not the count of successfully scored cases. Because failed or invalid judge responses are skipped from accumulation but remain in `num_cases`, evaluation failures effectively contribute zero to the average.

The evaluator does not separately report a successful-scoring count. `num_test_cases` is set to the total dataset length, not the number of successful judge responses. This is an important limitation when interpreting scores.

### 13.6 Persistence

The evaluator stores one `RAGEvaluation` record with:
- `timestamp = datetime.now()`;
- the four average metric values;
- `overall_score`;
- `num_test_cases = len(dataset)`;
- `model_used = JUDGE_MODEL`;
- `details = detailed_results`.

The `model_used` field records the judge model (`openai/gpt-oss-120b`), not the troubleshooting generation model.

The record is committed to PostgreSQL. If persistence raises an exception, the code rolls back and re-raises the exception.

### 13.7 Evaluation limitations

- The evaluator depends on the manually maintained `backend/evaluation_dataset.json`.
- The uploaded evaluator does not show automatic test-case generation.
- The judge is another LLM, so its scores are model judgments rather than deterministic ground-truth measurements.
- The prompt asks for integer scores from 1 to 5, but the code does not enforce the range or integer type.
- Failed judge cases are not counted separately and remain in the averaging denominator.
- Context is truncated to 1,500 characters before being sent to the judge.
- No confidence interval, repeated-run variance, or inter-judge agreement is computed by this file.
- An empty dataset also causes division by zero during average calculation; the evaluator does not contain an explicit empty-dataset guard.

---

## 14. Startup Lifecycle

RAG resources are pre-loaded during FastAPI startup rather than lazily on first request:

```python
@app.on_event("startup")
def load_rag_models():
    _build_vector_store()
    _get_reranker()
    _get_llm()
```

```text
FastAPI startup
      |
      v
_build_vector_store()
      |
      +---- Fingerprint match ---> load persisted index (fast)
      |
      +---- Mismatch -----------> rebuild from PostgreSQL (slow, once)
      |
      v
_get_reranker()   (BAAI/bge-reranker-v2-m3)
      |
      v
_get_llm()        (ChatGroq client)
      |
      v
Backend ready
```

Each accessor is memoized — the reranker and LLM client are loaded once per process. Combined with index persistence, this means **warm restarts are fast** and only the first run after a knowledge change pays the rebuild cost.

---

## 15. Configuration Reference

### 15.1 Models

| Component | Model |
|---|---|
| Embeddings | `BAAI/bge-large-en-v1.5` |
| Reranker | `BAAI/bge-reranker-v2-m3` |
| LLM | `openai/gpt-oss-20b` (Groq) |

### 15.2 Retrieval Parameters

| Parameter | Value |
|---|---|
| Child chunk size | 400 |
| Child chunk overlap | 50 |
| MMR candidate multiplier | `fetch_k * 2` |
| Shared retrieval helper `fetch_k` default | 20 |
| MMR candidate pool with default | 40 |
| MMR child results with default | Up to 20 |
| Runbook parent limit (`k`) | 2 per alarm-specific or fallback search |
| Command parent limit (`k`) | 2 per alarm-specific or fallback search |
| Historical parent limit (`k`, troubleshooting) | 3 |
| Historical parent limit (`k`, RCA) | 5 |
| Historical helper `fetch_k` | 20 |
| Reranker normalization | Enabled |
| LLM temperature | 0 |

### 15.3 RCA Parameters

The correlation values below are confirmed by the supplied `rca.py`. The eligibility gate is described by the earlier documentation as an API-route check, but the route source was not included in this verification set.

| Parameter | Value |
|---|---|
| Correlation window | 30 minutes |
| Correlation scope | Same node |
| Eligible statuses | `CLOSED` |
| Eligible priorities | `P1`, `P2` |

### 15.4 Environment Variables

```env
GROQ_API_KEY=your_groq_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/alarm_automation
```

### 15.5 File System Paths

| Constant | Purpose | Trust requirement |
|---|---|---|
| `FAISS_INDEX_DIR` | Persisted FAISS index | Application-owned, not externally writable |
| `PARENT_STORE_FILE` | Persisted parent store (pickle) | Application-owned, not externally writable |

---

## 16. AI Safety Principles

The RAG subsystem is designed as an **assistant, not an autonomous agent**.

### 16.1 Troubleshooting Constraints

The prompt explicitly instructs the model to:

- Use **only** retrieved commands.
- **Not invent** commands.
- **Not modify** retrieved shell commands.
- **Not execute** commands automatically.
- Treat historical incidents as **supporting evidence**, not guaranteed fixes.
- **Report insufficient knowledge** rather than speculate.

### 16.2 RCA Constraints

- Grounded strictly in ticket data and retrieved historical evidence.
- **Declines to assert a root cause** when evidence is insufficient.
- **Declines to assert a root cause** when output validation fails.
- Surfaces evidence gaps explicitly rather than concealing them.
- Returns deterministic correlation findings even when the LLM path fails.

### 16.3 Architectural Guarantees

| Guarantee | Mechanism |
|---|---|
| No cross-alarm contamination | Double filtering (FAISS + post-retrieval parent enforcement) |
| No command execution | No execution path exists in the codebase |
| No ticket mutation by AI | AI endpoints are strictly read-only |
| No internal error leakage | Generic 500 response, internal logging only |
| Reproducible guidance | Temperature 0 |
| Traceable evidence | `incident_id` metadata on historical documents |

### 16.4 Human-in-the-Loop Boundary

```text
AI may:                          AI may NOT:
  - recommend                  - execute commands
  - analyse                    - close tickets
  - correlate                  - change priority
  - cite evidence              - reopen tickets
  - report gaps                - modify the knowledge base directly*
```

*\*Knowledge base growth occurs only through explicit operator submission of the resolution questionnaire, never through AI generation.*

---

## 17. Current Limitations

1. **Alarm-type filter is strict.** An incident with a mislabelled or empty `alarm_type` that the fallback detector cannot resolve will be invisible to retrieval for that alarm type.
2. **Correlation window is fixed.** The 30-minute window is not configurable per alarm type or network topology; slow-propagating faults may fall outside it.
3. **Node-scoped correlation only.** Cross-node correlation (e.g. a shared transport link affecting multiple nodes) is not currently performed.
4. **Pickle-based persistence.** Requires strict file-system trust; unsuitable for shared or untrusted storage without replacement.
5. **Refresh is synchronous.** `refresh_vector_store()` runs after ticket closure, adding latency to the close operation when a rebuild is triggered.
6. **Knowledge quality is operator-dependent.** Closed-loop learning is only as good as the resolution questionnaires submitted; sparse documentation directly produces `evidenceGaps`.
7. **Evaluation scores depend on an LLM judge.** Invalid or failed judge responses are skipped from totals but remain in the dataset-size denominator, which can lower the reported averages.

---

## 18. Changelog

### Version 2.1 — November 03, 2026

**Corrected from source inspection**
- Documented the actual SHA-256 fingerprint inputs; it is not based on row count or `updated_at`.
- Corrected runbook/command `alarm_type` assignment to reflect `detect_alarm_type(record.content)`.
- Documented the exact 50-hyphen parent delimiter and clarified that parent blocks have no fixed size.
- Added the actual `fetch_k`, MMR candidate, child result, and final unique-parent limits for each retrieval path.
- Corrected the troubleshooting retrieval description to include runbook/command fallback searches without an alarm-type filter.
- Replaced the inferred RCA schema with the exact LLM output keys and successful outer response fields.
- Described the RCA validator accurately as basic JSON structure and enum checks, not schema or grounding validation.
- Rewrote the evaluation section from `evaluate.py`, including dataset format, judge model, metrics, scoring, persistence, and failure-denominator behavior.

### Version 2.0 — November 03, 2026

**Added**
- PostgreSQL-backed knowledge retrieval (`knowledge_documents`, `historical_incidents`) replacing text-file ingestion.
- FAISS index and parent-store **disk persistence** with database fingerprint validation.
- `refresh_vector_store()` hook enabling **closed-loop learning** from resolution questionnaires.
- Explicit metadata contract (`source_type`, `alarm_type`, `parent_id`, `incident_id`) assigned at document creation.
- Metadata-filtered MMR retrieval with **post-retrieval parent-level enforcement**.
- Defensive handling of `FlagReranker` scalar/mismatched-score returns.
- **Root Cause Analysis pipeline** (`backend/rca.py`) with:
  - 30-minute same-node temporal alarm correlation.
  - Current-ticket resolution evidence formatting with explicit `"Not documented"` markers.
  - Systematic `resolution_evidence_gaps` detection and order-preserving deduplication.
  - Two guarded fallback paths (insufficient knowledge, validation failure).
- **RAG evaluation** subsystem persisting five quality metrics to `rag_evaluations`.

**Changed**
- `alarm_type` for historical incidents now read from PostgreSQL, with `detect_alarm_type()` used only as a fallback for empty values.
- Non-`runbook`/`commands` source types are explicitly excluded from vector indexing.
- Child metadata is explicitly re-assigned after splitting as a robustness contract.
- Startup now loads persisted artifacts when the fingerprint matches, rather than always rebuilding.

**Removed / Deprecated**
- Runtime ingestion of `knowledge/telecom_runbooks.txt`, `shell_commands.txt`, and `historical_incidents.txt` (retained only as one-time migration inputs for root-level `migrate_knowledge.py`).

---

## Disclaimer

This RAG subsystem is part of a personal/educational prototype. The runbooks, diagnostic commands, historical incidents, alarm data, and correlation logic are simulated for demonstration purposes. They must not be interpreted as Ericsson production architecture, Ericsson internal procedures, or approved network operational instructions.
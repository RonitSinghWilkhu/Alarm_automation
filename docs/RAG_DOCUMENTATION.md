# RAG DOCUMENTATION

## 1. Purpose

The project contains a Retrieval-Augmented Generation (RAG)
troubleshooting assistant.

Its purpose is to take the operational context of a ticket, retrieve
relevant troubleshooting knowledge from the project's local knowledge
files, rerank the retrieved content, and use a Groq-hosted LLM to
generate an operator-oriented troubleshooting recommendation.

The RAG implementation is located in:

``` text
backend/rag.py
```

The FastAPI layer invokes the RAG system through:

``` python
troubleshoot_alarm(...)
```

The RAG assistant is used for troubleshooting guidance. It does not make
the ticket priority decision, close tickets, upgrade tickets, or execute
shell commands.

------------------------------------------------------------------------

## 2. Current RAG Flow

The current implementation follows this flow:

``` text
Ticket
   |
   v
FastAPI /troubleshoot/{ticket_number}
   |
   v
troubleshoot_alarm(...)
   |
   v
_build_vector_store()
   |
   +--> telecom_runbooks.txt
   +--> shell_commands.txt
   +--> historical_incidents.txt
   |
   v
Split knowledge into blocks
   |
   v
Assign metadata + parent IDs
   |
   v
Split parents into 400-character child chunks
   |
   v
Hugging Face embeddings
BAAI/bge-large-en-v1.5
   |
   v
FAISS vector store
   |
   v
MMR retrieval
   |
   v
FlagReranker
BAAI/bge-reranker-v2-m3
   |
   v
Select top child chunks
   |
   v
Resolve parent documents
   |
   v
Build runbook / command / historical context
   |
   v
Groq ChatGroq
openai/gpt-oss-20b
   |
   v
Troubleshooting recommendation
```

------------------------------------------------------------------------

## 3. Knowledge Sources

The RAG system loads three text files from the project's `knowledge`
directory.

### 3.1 Telecom runbooks

``` text
knowledge/telecom_runbooks.txt
```

Loaded using `TextLoader`.

These documents are classified as:

``` text
source_type = "runbook"
```

unless their content is identified as another source type.

### 3.2 Diagnostic commands

``` text
knowledge/shell_commands.txt
```

Loaded using `TextLoader`.

Documents containing:

``` text
COMMAND REFERENCE:
```

are classified as:

``` text
source_type = "commands"
```

### 3.3 Historical incidents

``` text
knowledge/historical_incidents.txt
```

Loaded using `TextLoader`.

Documents containing:

``` text
HISTORICAL INCIDENT:
```

are classified as:

``` text
source_type = "historical"
```

The historical incident source is used as supporting evidence for
troubleshooting rather than as an unconditional resolution.

------------------------------------------------------------------------

## 4. Knowledge Block Creation

The three loaded text documents are split using this delimiter:

``` text
--------------------------------------------------
```

The `split_into_blocks()` helper:

1.  Iterates through loaded documents.
2.  Splits their `page_content` using the delimiter.
3.  Removes surrounding whitespace.
4.  Discards empty blocks.
5.  Creates a new LangChain `Document` for every non-empty block.
6.  Copies the original document metadata.

The resulting blocks are combined into:

``` python
parents = runbook_chunks + command_chunks + historical_chunks
```

These are treated as the parent documents.

------------------------------------------------------------------------

## 5. Parent Metadata

Each parent document receives three important metadata fields.

### 5.1 Source type

The implementation determines the source type from the block content:

``` python
if "HISTORICAL INCIDENT:" in content:
    source_type = "historical"
elif "COMMAND REFERENCE:" in content:
    source_type = "commands"
else:
    source_type = "runbook"
```

Therefore the current source classification is:

  Content marker           `source_type`
  ------------------------ ---------------
  `HISTORICAL INCIDENT:`   `historical`
  `COMMAND REFERENCE:`     `commands`
  Otherwise                `runbook`

### 5.2 Alarm type

The implementation calls:

``` python
detect_alarm_type(content)
```

and stores the result as:

``` text
alarm_type
```

### 5.3 Parent ID

Every parent document receives a UUID:

``` python
parent.metadata["parent_id"] = str(uuid.uuid4())
```

This ID links child chunks back to their original parent document.

------------------------------------------------------------------------

## 6. Alarm-Type Detection

`rag.py` defines precompiled regular expressions for the following alarm
types:

``` text
HIGH_CPU
POWER_FAILURE
HIGH_TEMPERATURE
S1_LINK_DOWN
VSWR_HIGH
CELL_UNAVAILABLE
```

The patterns are case-insensitive and handle several formatting
variations.

Examples of the supported variations include:

``` text
HIGH_CPU
HIGH CPU
CPU HIGH
CPU UTILIZATION
```

for the `HIGH_CPU` category, and corresponding variations for the other
configured alarm types.

The detection function checks the patterns in order and returns the
first matching alarm type.

If nothing matches:

``` text
GENERAL
```

is returned.

------------------------------------------------------------------------

## 7. Parent and Child Chunking

The implementation uses a two-level representation.

### Parent documents

The complete knowledge blocks are retained in:

``` python
parent_store = {}
```

The dictionary is keyed by `parent_id`.

Conceptually:

``` text
parent_id
    |
    +--> complete runbook / command / historical document
```

### Child chunks

Each parent is further split using:

``` python
RecursiveCharacterTextSplitter(
    chunk_size=400,
    chunk_overlap=50
)
```

Therefore the current child-chunk configuration is:

  Parameter                  Value
  --------------- ----------------
  Chunk size        400 characters
  Chunk overlap      50 characters

The smaller child chunks are what get indexed for similarity retrieval.

The parent documents are retained so that the final response can use the
larger original knowledge block rather than only the small matching
fragment.

------------------------------------------------------------------------

## 8. Embeddings

The child chunks are embedded using:

``` python
HuggingFaceEmbeddings(
    model_name="BAAI/bge-large-en-v1.5",
    encode_kwargs={"normalize_embeddings": True}
)
```

The embedding model is therefore:

``` text
BAAI/bge-large-en-v1.5
```

Embeddings are normalized before being used by the vector store.

------------------------------------------------------------------------

## 9. FAISS Vector Store

The child documents and their embeddings are indexed using:

``` python
FAISS.from_documents(children, embeddings)
```

FAISS is therefore the vector similarity-search component of the current
implementation.

The vector store is built in memory by `_build_vector_store()`.

There is no code in the current `rag.py` that persists the FAISS index
to disk and reloads it later.

------------------------------------------------------------------------

## 10. Retrieval Strategy

The helper function:

``` python
_search_and_fetch_parents(...)
```

performs the retrieval process.

It first performs Maximal Marginal Relevance (MMR) search:

``` python
vectorstore.max_marginal_relevance_search(
    query,
    k=fetch_k,
    fetch_k=fetch_k * 2,
    filter=filter_dict
)
```

The default `fetch_k` is:

``` text
20
```

Therefore the current search requests:

``` text
k = 20
fetch_k = 40
```

The intention is to retrieve a larger and more diverse candidate pool
before reranking.

------------------------------------------------------------------------

## 11. Metadata Filtering

Retrieval is restricted using metadata filters.

The RAG function performs three separate retrieval operations.

### Runbook retrieval

``` python
{
    "source_type": "runbook",
    "alarm_type": alarm_type
}
```

### Command retrieval

``` python
{
    "source_type": "commands"
}
```

### Historical retrieval

``` python
{
    "source_type": "historical",
    "alarm_type": alarm_type
}
```

This means runbook and historical retrieval are alarm-type-specific,
while command retrieval currently searches the complete command source
category.

------------------------------------------------------------------------

## 12. Retrieval Fallbacks

The implementation includes fallback retrieval for runbooks and
historical incidents.

If no alarm-specific runbook results are found, it retries with:

``` python
{
    "source_type": "runbook"
}
```

If no alarm-specific historical results are found, it retries with:

``` python
{
    "source_type": "historical"
}
```

There is no equivalent fallback shown for command retrieval.

------------------------------------------------------------------------

## 13. Reranking

After MMR retrieval, the child chunks are reranked using:

``` python
FlagReranker(
    "BAAI/bge-reranker-v2-m3",
    use_fp16=False
)
```

The reranker model is:

``` text
BAAI/bge-reranker-v2-m3
```

For every retrieved child chunk, the implementation creates a pair:

``` python
[query, child.page_content]
```

The pairs are passed to:

``` python
reranker.compute_score(
    pairs,
    normalize=True
)
```

The resulting scores are paired with the child documents and sorted in
descending order.

Only the top `k` children are retained.

For the troubleshooting calls in the current implementation:

``` text
k = 2
```

Therefore each retrieval category initially returns up to two top-ranked
child matches before parent resolution.

------------------------------------------------------------------------

## 14. Parent Resolution

After reranking, the implementation does not send the selected child
chunks directly to the LLM.

Instead, it reads each child's:

``` text
parent_id
```

and looks up the corresponding full document in:

``` python
parent_store
```

A set is used to avoid adding the same parent more than once.

The result is a list of full parent documents.

This gives the RAG flow:

``` text
Small child chunk
      |
      v
Precise retrieval + reranking
      |
      v
parent_id
      |
      v
Full parent document
      |
      v
LLM context
```

------------------------------------------------------------------------

## 15. Query Construction

The current troubleshooting query is constructed from the alarm type:

``` python
query = (
    "How do I troubleshoot "
    + alarm_type
    + "?"
)
```

For example:

``` text
How do I troubleshoot HIGH_CPU?
```

The current retrieval query therefore does not directly include the
node, occurrence count, users impacted, severity, priority, or assigned
team.

Those ticket fields are instead supplied later in the LLM prompt.

------------------------------------------------------------------------

## 16. Ticket Context

`troubleshoot_alarm()` accepts the following ticket information:

``` text
alarm_type
node
occurrence_count
users_impacted
severity
threshold_breached
impact_level
priority
assigned_team
```

These values are placed into the LLM prompt under:

``` text
TICKET INFORMATION
```

The ticket context therefore informs the generation step even though the
retrieval query itself is based only on the alarm type.

------------------------------------------------------------------------

## 17. Context Assembly

Three contexts are created:

``` python
runbook_context
command_context
historical_context
```

Each is created by joining the retrieved parent documents with:

``` text
\n\n
```

The final combined retrieved context is also returned as:

``` python
retrieved_context
```

The combined context has the conceptual structure:

``` text
Runbook knowledge

Diagnostic command knowledge

Historical incident knowledge
```

------------------------------------------------------------------------

## 18. No-Knowledge Fallback

If all three retrieved contexts are empty:

``` text
runbook_context
command_context
historical_context
```

the function does not call the LLM.

Instead it returns a recommendation explaining that no relevant
troubleshooting knowledge was found for the supplied alarm type.

It also returns:

``` python
"historicalIncidents": []
"retrieved_context": ""
```

------------------------------------------------------------------------

## 19. LLM

The LLM is initialized lazily through:

``` python
_get_llm()
```

The implementation creates:

``` python
ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0
)
```

Therefore the current generation model is:

``` text
openai/gpt-oss-20b
```

through the `ChatGroq` integration.

Temperature is:

``` text
0
```

The LLM is intended to produce concise, operational troubleshooting
guidance from the retrieved context.

------------------------------------------------------------------------

## 20. LLM Prompt Structure

The prompt explicitly identifies the assistant as:

``` text
a telecom operations troubleshooting assistant
```

It provides:

1.  Ticket information.
2.  Retrieved runbook knowledge.
3.  Retrieved diagnostic commands.
4.  Retrieved historical incidents.

The requested output contains:

1.  What the alarm indicates.
2.  Why the ticket may require attention.
3.  Recommended troubleshooting steps.
4.  Relevant diagnostic commands.
5.  Escalation recommendation.

------------------------------------------------------------------------

## 21. Output Formatting Rules

The prompt instructs the LLM to:

-   Use numbered lists for troubleshooting steps.
-   Give command steps sequentially.
-   Use bullet points for diagnostic commands.
-   Explain each command briefly.
-   Avoid Markdown tables.
-   Avoid `|` table formatting.
-   Avoid repeating sections.
-   Keep the response concise and operational.

The prompt also instructs the LLM to use only commands present in the
retrieved knowledge.

------------------------------------------------------------------------

## 22. Hallucination Controls

The prompt contains explicit restrictions intended to prevent fabricated
operational guidance.

The LLM is told:

``` text
Use only commands present in the retrieved knowledge.
Do not invent commands.
Do not automatically execute commands.
```

It is also instructed not to invent or modify shell commands.

If the retrieved information is insufficient, the prompt requires the
explicit statement:

``` text
Insufficient data in the knowledge base to resolve this issue.
```

Therefore the current RAG design uses retrieval-grounded generation
rather than asking the LLM to freely generate operational commands.

------------------------------------------------------------------------

## 23. Historical Incident Handling

Historical incidents are retrieved separately from runbooks and
commands.

The LLM is told that historical incidents:

-   represent previous operational experiences and resolutions;
-   should be used as supporting evidence;
-   should not automatically be assumed to be correct for the current
    ticket;
-   should be considered together with current ticket information and
    runbook information.

The returned API data includes historical incidents in the form:

``` json
{
    "content": "...",
    "alarmType": "..."
}
```

for each retrieved historical result.

------------------------------------------------------------------------

## 24. RAG Result Structure

A successful `troubleshoot_alarm()` call returns:

``` python
{
    "recommendation": response.content,

    "historicalIncidents": [
        {
            "content": "...",
            "alarmType": "..."
        }
    ],

    "retrieved_context": "..."
}
```

The main user-facing field is:

``` text
recommendation
```

The historical incidents are returned separately, while the complete
combined retrieval context is also retained in the result.

------------------------------------------------------------------------

## 25. FastAPI Integration

The FastAPI endpoint is:

``` text
GET /troubleshoot/{ticket_number}
```

The API first finds the ticket in PostgreSQL.

It extracts:

``` text
alarmType
node
occurrenceCount
usersImpacted
severity
thresholdBreached
impactLevel
priority
assignedTeam
```

and passes them to:

``` python
troubleshoot_alarm(...)
```

The FastAPI layer then returns:

``` json
{
    "alarmType": "...",
    "recommendation": "...",
    "historicalIncidents": [...]
}
```

The `retrieved_context` returned internally by the RAG function is not
included in the FastAPI response shown by the current endpoint.

------------------------------------------------------------------------

## 26. RAG Initialization During FastAPI Startup

The FastAPI application initializes RAG resources during application
startup.

The startup handler calls:

``` python
_build_vector_store()
_get_llm()
_get_reranker()
```

This causes the vector store, LLM, and reranker to be initialized before
normal troubleshooting requests.

The RAG objects are also designed with module-level variables:

``` python
_llm = None
_reranker = None
_vector_store = None
```

and getter functions intended to create the resources only when first
required.

### Current implementation detail

`_get_llm()` and `_get_reranker()` assign their created clients to their
respective module-level variables.

However, `_build_vector_store()` currently constructs and returns:

``` python
{
    "vectorstore": vectorstore,
    "parent_store": parent_store
}
```

without assigning that returned object to the module-level
`_vector_store`.

Therefore, despite the comment describing the vector store as a
lazy-loaded singleton, the current function does not persist the built
vector store in `_vector_store`.

As a result, a subsequent `_build_vector_store()` call can rebuild the
FAISS index.

This documentation records the implementation as it currently exists
rather than treating the intended singleton behavior as the actual
behavior.

------------------------------------------------------------------------

## 27. RAG Runtime Characteristics

The current implementation has the following characteristics:

  Component                          Current implementation
  ---------------------------------- ------------------------------------------
  Knowledge format                   Plain text files
  Knowledge sources                  Runbooks, commands, historical incidents
  Loader                             LangChain `TextLoader`
  Parent delimiter                   50-hyphen separator
  Child chunk size                   400 characters
  Child overlap                      50 characters
  Embedding model                    `BAAI/bge-large-en-v1.5`
  Vector store                       FAISS
  Initial retrieval                  MMR
  Candidate retrieval size           20
  Internal MMR fetch size            40
  Reranker                           `BAAI/bge-reranker-v2-m3`
  Reranker precision                 `use_fp16=False`
  Final child results per category   2
  LLM integration                    `ChatGroq`
  LLM model                          `openai/gpt-oss-20b`
  LLM temperature                    0
  Retrieval filters                  `source_type`, `alarm_type`
  Parent lookup                      In-memory dictionary
  Persistent vector index            Not implemented

------------------------------------------------------------------------

## 28. End-to-End Troubleshooting Example

For a ticket such as:

``` text
Alarm Type: HIGH_CPU
Node: NODE-101
Occurrence Count: 3
Users Impacted: 250
Severity: Major
Threshold Breached: True
Impact Level: HIGH
Priority: P4
Assigned Team: Platform
```

the current RAG flow is:

``` text
HIGH_CPU ticket
      |
      v
FastAPI /troubleshoot/{ticket_number}
      |
      v
troubleshoot_alarm(...)
      |
      v
Query:
"How do I troubleshoot HIGH_CPU?"
      |
      +--------------------+
      |                    |
      v                    v
Runbook retrieval     Command retrieval
HIGH_CPU filter       source_type=commands
      |
      v
Historical retrieval
HIGH_CPU filter
      |
      v
MMR candidate retrieval
      |
      v
BGE reranker
      |
      v
Top child chunks
      |
      v
Parent document lookup
      |
      +--------------------+
      |         |          |
      v         v          v
   Runbook   Commands   Historical
      |         |          |
      +---------+----------+
                |
                v
         LLM prompt
                |
                v
       Groq / GPT OSS 20B
                |
                v
       Recommendation
```

------------------------------------------------------------------------

## 29. Separation of Responsibilities

The project deliberately separates deterministic ticket processing from
AI-assisted troubleshooting.

### Deterministic ticket system

The backend/database layer handles:

``` text
Ticket creation and storage
Ticket priority
Ticket status
Ticket closure
Ticket reopening
Ticket events
Notifications
```

### RAG/LLM system

The RAG layer handles:

``` text
Knowledge retrieval
Knowledge reranking
Troubleshooting explanation
Diagnostic command presentation
Historical incident context
Escalation guidance
```

The RAG system therefore acts as an assistance layer rather than the
system of record for ticket state.

------------------------------------------------------------------------

## 30. Current Limitations Visible in the Implementation

The current `rag.py` implementation has several implementation-level
limitations:

### In-memory FAISS construction

The FAISS index is created in memory from the knowledge files.

There is no persistent FAISS index loading/saving code in `rag.py`.

### Vector-store singleton mismatch

`_vector_store` is declared as a module-level cache variable, but
`_build_vector_store()` does not assign the generated
vector-store/parent-store object to it.

Therefore the intended cache behavior is not fully implemented.

### Retrieval query uses only alarm type

The retrieval query is:

``` text
How do I troubleshoot <alarm_type>?
```

The other ticket fields are available to the LLM but are not included in
the retrieval query.

### Command filtering is broader

Command retrieval filters only on:

``` text
source_type = commands
```

It does not additionally filter commands by `alarm_type`.

### UUIDs are regenerated

Parent IDs are generated using:

``` python
uuid.uuid4()
```

when the vector store is built.

Therefore parent IDs are not deterministic across separate builds.

### Knowledge source dependency

The RAG pipeline depends on the three knowledge files being available at
the configured project paths.

### External model dependencies

The embedding model, reranker, and Groq LLM require their respective
runtime dependencies and model/API availability.

------------------------------------------------------------------------

## 31. Important Distinction From Older RAG Descriptions

Some older project documentation describes a different RAG architecture
using components such as:

``` text
Qdrant
OpenAI embeddings
MultiQueryRetriever
EnsembleRetriever
BM25
CrossEncoder
```

Those details do not match the current `backend/rag.py` implementation
inspected for this documentation.

The current implementation actually uses:

``` text
FAISS
HuggingFaceEmbeddings
BAAI/bge-large-en-v1.5
MMR retrieval
FlagReranker
BAAI/bge-reranker-v2-m3
ChatGroq
openai/gpt-oss-20b
```

This document therefore follows the current source code rather than the
older architecture description.

------------------------------------------------------------------------

## 32. File Responsibilities

  --------------------------------------------------------------------------
  File / Component                       Responsibility
  -------------------------------------- -----------------------------------
  `backend/rag.py`                       Complete RAG implementation

  `knowledge/telecom_runbooks.txt`       Troubleshooting runbook knowledge

  `knowledge/shell_commands.txt`         Diagnostic command knowledge

  `knowledge/historical_incidents.txt`   Historical incident knowledge

  `backend/main.py`                      FastAPI endpoint and ticket-context
                                         extraction

  `frontend` troubleshooting UI          Requests troubleshooting
                                         recommendation and displays the
                                         result
  --------------------------------------------------------------------------

------------------------------------------------------------------------

## 33. Overall RAG Architecture

The current architecture can be summarized as:

``` text
                 KNOWLEDGE FILES
                       |
       +---------------+----------------+
       |               |                |
       v               v                v
   Runbooks        Commands        Historical
       |               |                |
       +---------------+----------------+
                       |
                       v
                TextLoader
                       |
                       v
                 Block split
                       |
                       v
              Metadata tagging
                       |
                       v
                Parent documents
                       |
                       v
             400-char child chunks
                       |
                       v
             BGE-large embeddings
                       |
                       v
                    FAISS
                       |
                       v
              MMR candidate search
                       |
                       v
                 BGE reranker
                       |
                       v
              Top child chunks
                       |
                       v
               Parent resolution
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Runbook      Commands     Historical
       context      context       context
          \            |            /
           \           |           /
            +----------+----------+
                       |
                       v
              Ticket-aware prompt
                       |
                       v
              Groq ChatGroq
              openai/gpt-oss-20b
                       |
                       v
          Troubleshooting recommendation
```

------------------------------------------------------------------------

## 34. Summary

The current RAG implementation is a local, FAISS-based retrieval
pipeline integrated into the FastAPI backend.

It:

1.  Loads runbook, command, and historical incident text files.
2.  Splits them into parent knowledge blocks.
3.  Adds source and alarm-type metadata.
4.  Splits parents into 400-character child chunks with 50-character
    overlap.
5.  Creates normalized embeddings using `BAAI/bge-large-en-v1.5`.
6.  Stores the child vectors in FAISS.
7.  Retrieves a diverse candidate set using MMR.
8.  Reranks candidates using `BAAI/bge-reranker-v2-m3`.
9.  Maps selected child chunks back to their complete parent documents.
10. Separately assembles runbook, command, and historical contexts.
11. Places the retrieved knowledge and ticket details into a controlled
    prompt.
12. Uses `openai/gpt-oss-20b` through `ChatGroq` with temperature 0.
13. Returns an operator-oriented troubleshooting recommendation and
    historical incident data.

The RAG layer is therefore a **retrieval-grounded troubleshooting
assistant** connected to the ticket workflow, while ticket state and
lifecycle remain controlled by the FastAPI/PostgreSQL application.

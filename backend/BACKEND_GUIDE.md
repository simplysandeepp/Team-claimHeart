# ClaimHeart Backend — Developer Guide

> Simple reference for how the backend is structured, how to run it, what to test, and where each file lives.

---

## How the Backend Works (In Plain English)

A hospital uploads a medical document (PDF/image).
The system reads it, checks it against the insurance policy, investigates for fraud, and makes a routing decision.

```
Document Upload
      │
      ▼
 Agent 01 (OCR Extractor)
     Reads the document with EasyOCR
     Extracts: patient name, disease, amount, medications, hospital days
      │
      ▼
 Agent A1 (Policy OCR)
     Loads the insurance policy from mock_policies.json
      │
      ▼
 Agent A2 (Policy Agent)
     Checks the claim against the policy rules:
     - Is the disease covered?
     - Is the amount under the sub-limit?
     - Are hospital days within limit?
     - Is waiting period satisfied?
      │
      ▼
 Agent A3 (Fraud Investigator)
     Scores the claim for fraud:
     - Missing fields?
     - Duplicate claim for same diagnosis?
     - Amount busts the policy cap?
     - ML anomaly detected?
      │
      ▼
 Decision Router (R5 → R3/R4)
     R5: Is fraud confirmed?
       YES → Mediator Agent
       NO  → R4 (missing docs?) or R3 (approve/escalate)
      │
      ▼
 Agent 04 (Mediator) — only if fraud confirmed
     Sends email to insurer, patient, hospital
     Issues OTP for identity check
     Generates formal decision letters
     Writes audit packet to disk
```

---

## Folder Map — What Lives Where

```
backend/
│
├── app/
│   ├── agents/                   ← The "brain" modules
│   │   ├── extractor/agent.py    ← Agent 01: Runs OCR + builds unified claim
│   │   ├── policy/
│   │   │   ├── agent_a1_ocr.py   ← Agent A1: Policy document loader interface
│   │   │   └── policy_agent.py   ← Agent A2: Evaluates claim vs policy
│   │   ├── investigator/         ← Agent A3 (wired via fraud_service.py)
│   │   └── mediator/agent.py     ← Agent 04: Email + OTP + Letters
│   │
│   ├── api/routes/               ← HTTP endpoints (what Swagger shows)
│   │   ├── ocr.py                ← POST /api/ocr/upload, /process-local
│   │   ├── fraud.py              ← POST /api/fraud/decision
│   │   ├── claims.py             ← Placeholder for future claim CRUD
│   │   └── health.py             ← GET /api/health
│   │
│   ├── services/                 ← Core business logic
│   │   ├── claim_builder.py      ← Converts raw OCR output → unified claim dict
│   │   ├── rag_service.py        ← Agent A2 rules engine (analyze_claim)
│   │   ├── fraud_service.py      ← Agent A3 scoring engine (DecisionEngine)
│   │   ├── decision_router.py    ← R5/R3/R4 routing logic
│   │   ├── pipeline.py           ← Master orchestrator (runs everything end-to-end)
│   │   ├── tat_monitor.py        ← Turnaround time tracking (SLA check)
│   │   ├── ml_anomaly.py         ← Isolation Forest ML scoring
│   │   ├── mock_db2_repo.py      ← Saves fraud decisions to disk (simulated DB2)
│   │   ├── rag_1_ingestion.py    ← Ingests patient docs for Dr. Chat (RAG 1)
│   │   └── rag_2_ingestion.py    ← Ingests policy docs for Policy Chatbot (RAG 2)
│   │
│   ├── schemas/
│   │   └── fraud.py              ← Pydantic models: FraudSignal, ClaimContext, DecisionResponse
│   │
│   ├── utils/
│   │   ├── policy_loader.py      ← Loads & validates mock_policies.json (cached)
│   │   ├── ocr.py                ← EasyOCR wrapper
│   │   └── parser.py             ← Converts raw OCR text → structured fields
│   │
│   ├── extraction/
│   │   └── rule_engine.py        ← Field extraction rules + confidence scoring
│   │
│   └── data/                     ← Auto-generated data files (gitignore these)
│       ├── mock_policies.json    ← The single source of truth for policy rules
│       ├── db2_mock.jsonl        ← Fraud decision log (written by Agent A3)
│       ├── mediator_packets.jsonl ← Mediator output log (written by Agent 04)
│       └── tat_logs.jsonl        ← Pipeline timing log (written by TAT monitor)
│
├── tests/                        ← All test files
│   ├── test_pipeline_e2e.py      ← Main: full pipeline tests (happy/suspicious/rejection/escalation)
│   ├── services/
│   │   ├── test_fraud_service.py ← Unit tests: fraud scoring logic
│   │   └── test_rule_based_extraction.py ← Unit tests: OCR field extraction
│   └── agents/
│       └── test_extractor.py     ← Unit tests: extractor agent
│
└── todo.md                       ← Project roadmap & completion tracker
```

---

## How to Run the Backend

### 1. Activate the Virtual Environment

```bash
cd /Users/sandeepprajapati/Desktop/claimheart/backend
source /Users/sandeepprajapati/Desktop/Projects/claimHeart-Testing/venv/bin/activate
```

### 2. Start the API Server

```bash
uvicorn app.main:app --reload
```

Open Swagger UI at: **http://localhost:8000/docs**

---

## How to Test

### Run E2E Pipeline Tests (most important)

Tests the full claim pipeline using synthetic data — no real documents needed.

```bash
PYTHONPATH=. python3 tests/test_pipeline_e2e.py
```

All 4 tests should print `[PASS]`.

---

### What Each E2E Test Covers

| Test | What It Simulates | Expected Verdict |
|------|-------------------|-----------------|
| Happy Path | Normal clean claim, low amount | `NEEDS_DOCUMENTS` or `CLEAN_APPROVED` |
| Suspicious Path | High amount, policy flags fired | `FRAUD_CONFIRMED` → Mediator triggered |
| Rejection Path | Multiple violations, huge amount | `FRAUD_CONFIRMED` → `AWAITING_HUMAN_REVIEW` |
| Escalation Rule | Noisy OCR, low confidence | Never auto-approved → escalates |

---

### Run Individual Unit Tests

```bash
# Fraud engine rules
PYTHONPATH=. python3 -m pytest tests/services/test_fraud_service.py -v

# OCR field extraction rules
PYTHONPATH=. python3 -m pytest tests/services/test_rule_based_extraction.py -v

# Extractor agent
PYTHONPATH=. python3 -m pytest tests/agents/test_extractor.py -v
```

---

## How to Track What's Happening (Audit Files)

Every time you run the pipeline, three log files get written:

### Fraud Decisions (Agent A3 output)
```bash
cat app/data/db2_mock.jsonl
```
Shows: `claim_id`, `decision`, `risk_score`, `signals` (what fraud rules fired).

### Mediator Packets (Agent 04 output)
```bash
cat app/data/mediator_packets.jsonl
```
Shows: emails sent, letters generated, OTP issued — only written when fraud is confirmed.

### TAT / Timing Logs
```bash
cat app/data/tat_logs.jsonl
```
Shows: how long each pipeline stage took, which stages breached SLA limits.

> **To clear these files between test runs:**
> ```bash
> > app/data/db2_mock.jsonl
> > app/data/tat_logs.jsonl
> > app/data/mediator_packets.jsonl
> ```

---

## Quick Spot-Check Commands

Test individual components without running the full suite:

```bash
# Check policy loads correctly
PYTHONPATH=. python3 -c "
from app.utils.policy_loader import get_policy_data
p = get_policy_data()
print('Diseases in policy:', len(p['CARE-COMPREHENSIVE-MASTER-2026']['disease_sub_limits']))
"

# Check A2 policy analysis works
PYTHONPATH=. python3 -c "
from app.services.rag_service import analyze_claim
result = analyze_claim({'disease': 'Dengue Fever', 'amount': 15000, 'hospital_stay_days': 3, 'medications_count': 2, 'diagnostic_tests_count': 1})
print(result)
"

# Check fraud engine works
PYTHONPATH=. python3 -c "
from app.schemas.fraud import ClaimContext
from app.services.fraud_service import DecisionEngine
engine = DecisionEngine()
ctx = ClaimContext(claim_data={'claim_id':'X1','patient_id':'P1','claim_amount':15000,'incident_date':'2026-04-01'}, policy_rules=[], fraud_patterns=[], ocr_confidence=0.95, ocr_text='Clean text')
result = engine.evaluate(ctx)
print('Decision:', result.decision, '| Risk Score:', result.risk_score)
"
```

---

## Key Things to Know

| Rule | Why |
|------|-----|
| `mock_policies.json` is the single source of truth | Never hardcode disease names in code |
| Policy data is cached with `@lru_cache` | Only reads disk once per server lifetime |
| Mediator fires **only** on `FRAUD_CONFIRMED` | It never fires for clean or ambiguous claims |
| System **never hard-rejects** autonomously | All fraud cases go to `AWAITING_HUMAN_REVIEW` |
| `db2_mock.jsonl` is append-only | Clear it manually before fresh test runs |

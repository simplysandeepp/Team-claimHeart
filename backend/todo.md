# ClaimHeart Detailed System & Roadmap Todo

This checklist combines the specific backend engineering tasks with the detailed architecture from the "Insurance Platform — Detailed System Report".

## 1. Registration & User Management
- [ ] Implement Unified Registration Form with role selection (Patient / Hospital / Insurance)
- [ ] **Patient Registration:** Collect Name, Email, Phone, Password (No routes or DB models exist yet)
- [ ] **Hospital Registration:** Collect Registration identifier, NPI (for trust verification)
- [ ] **Insurance Verification:** Collect GST No., PAN No., Address, IRDAI License Number for profile verification (Supports sub-logins)

## 2. Patient Dashboard & Services
### Cashless Track Flow
- [ ] Link patient to Hospital record to fetch identification documents automatically
- [ ] Implement Patient Track System for real-time visibility into cases
- [ ] Implement Hospital AL No. (Authorization Letter) generation
- [ ] Implement Pre-Admission doc attachment (Re-auth Form, Prescription, Diagnoses)
- [ ] Implement Patient Admit trigger (notifies insurance to release 40-50% initial payment)
- [ ] Implement During Admission tracking (Tests, Billings)
- [ ] Implement Discharge Summary submission for final settlement

### Reimbursement Track Flow
- [ ] Implement patient post-discharge upload facility
- [ ] Collect Prescription and Additional Forms
- [ ] Collect Discharge Summary (Mandatory fields: Days of admission, medicines, diagnosis, hospital name)
- [ ] (Note: Patient handles queries manually, no automated escalation here)

## 3. Insurance Dashboard & Routing
- [ ] Implement unified Live Data Aggregation from Patient & Hospital inputs
- [ ] Implement Global Unique Claim ID assignment (e.g. `Id-claim123`)
- [ ] Implement 4-Quadrant Grid View (New Claim, Pending Claim, Completed Claim, Decision) for both Cashless and Reimbursement
- [ ] Implement Decision Routing: Agent Workflow path vs. Human Verification Needed path

## 4. Agent Workflow Pipeline

### Agent 01 — Document Intake & OCR Extraction
- ✅ Hospital document intake flow defined (input -> OCR -> decision)
- ✅ OCR upload APIs available (`POST /api/ocr/upload` and `POST /api/ocr/process-local`)
- ✅ File type and max-size (10MB) validation implemented
- ✅ OCR text extraction implemented via EasyOCR
- ✅ Basic parsing to structured fields implemented
- ✅ Ensure extractor outputs full roadmap fields: patient_id, diagnosis, ICD-10, billed_amount, tests_ordered, hospitalization_days, doctor_name, hospital_name, prescription_items
- ✅ Add confidence scoring per extracted field
- ✅ Pass OCR output to Rag 1 (Powers Dr. Chats)
- ✅ Pass OCR output to Agent A2 (Policy Agent)

### Agent A1 — Policy OCR Agent (Foundation)
- ✅ Keep a single source policy file at `backend/app/data/mock_policies.json`
- ✅ Confirm core policy blocks exist: policy_metadata, global_conditions, disease_sub_limits
- ✅ Ensure A1 generates hard-coded JSON from policy documents
- ✅ Pass A1 output to Rag 2 (Powers Patient Rag / Patient Structured Info & Policy Chatbot)
- ✅ Create policy loader utility with validation + clear error handling
- ✅ Add cache layer for policy lookups

### Agent A2 — Policy Agent
- ✅ Initial policy analysis step logically wired (via `app/services/rag_service.py`)
- ✅ Refactor `rag_service.py`: Currently uses outdated `covered`/`allowed_medications` schema. MUST be updated to parse the new `disease_sub_limits` schema.
- ✅ Cross-reference OCR Patient Data with Policy info (via DB1/Data)
- ✅ Add disease-level matching against disease_sub_limits
- ✅ Enforce waiting-period waterfall: disease-specific override, else global waiting
- ✅ Enforce sub-limit checks: max_payable_inr and max_hospitalization_days_allowed
- ✅ Enforce protocol checks: max_diagnostic_tests_per_day and max_pharmacy_dosages_per_day
- ✅ Emit clean Extracted Structured Data (with policy citations) to Fraud Agent

### Agent A3 — Fraud Investigator
- ✅ Fraud decision endpoint exists (`POST /api/fraud/decision`)
- ✅ Deterministic fraud scoring engine implemented
- ✅ Rule signals for missing fields, high amount, OCR quality, and pattern hits implemented
- ✅ Add duplicate-claim detection using patient_id + diagnosis + time window
- ✅ Add tests/day fraud check: `tests_per_day > max_diagnostic_tests_per_day`
- ✅ Add sub-limit bust fraud signal: `amount > max_payable_inr`
- ✅ Add Isolation Forest anomaly scoring with feature pipeline
- ✅ Add explainable fraud evidence array with rule id, value, threshold
- ✅ Write findings to DB2

### Decision Routing — Nodes R5, R3, R4
- ✅ **Node R5 (Fraud Verdict):** Evaluates Fraud Agent output (Routes to YES or NO)
- ✅ **Node R3 & R4 (No Fraud / Route NO):** Re-route clean claims, ask for confirmation or additional documents.
- ✅ **(Route YES):** Directly trigger Mediator Agent for fraud handling.

### Agent 04 — Mediator Agent
- ✅ Triggered only on R5 -> YES (Fraud Detected)
- ✅ Aggregate policy + fraud outputs into final decision packet
- ✅ Fire **Email channel:** Notification to insurer/patient/hospital
- ✅ Fire **OTP channel:** One-Time Password for identity verification/follow-up action
- ✅ Generate decision letters and hospital queries

## 5. Escalation & Quality Gates
- ✅ **Implement Query Escalation Rule:** Prevent automated models from hard rejecting on ambiguity. Route to Doctor / Verification Member.
- ✅ End-to-end happy-path test (upload -> extractor -> policy -> fraud -> mediator packet)
- ✅ End-to-end suspicious-path test (policy pass + fraud flag -> mediator escalation)
- ✅ End-to-end rejection-path test (policy violation -> denial packet)

## 6. Future Add-ons
- ✅ **TAT Monitor (Turnaround Time Monitor):** Design specs to track time taken across claim stages.
- ✅ Define SLA thresholds per pipeline stage.
- [ ] Integrate TAT Monitor into Insurance Dashboard UI.

# ClaimHeart Roadmap Todo (Till Mediator Agent)

## 1) Foundation And Data Source

- ✅ Keep a single source policy file: backend/app/db/mock_policies.json
- ✅ Confirm core policy blocks exist: policy_metadata, global_conditions, disease_sub_limits
- [ ] Create policy loader utility with validation + clear error handling
- [ ] Add cache layer for policy lookups to avoid repeated full-file reads
- [ ] Add unit tests for policy JSON schema and required fields

## 2) Document Intake And OCR (Agent 01 Extractor)

- ✅ Hospital document intake flow defined (input -> OCR -> decision)
- ✅ OCR upload API available: POST /api/ocr/upload
- ✅ Local OCR API available: POST /api/ocr/process-local
- ✅ File type and max-size validation implemented
- ✅ OCR text extraction implemented via EasyOCR
- ✅ Basic parsing to structured fields implemented
- [ ] Ensure extractor outputs full roadmap fields: patient_id, diagnosis, ICD-10, billed_amount, tests_ordered, hospitalization_days, doctor_name, hospital_name, prescription_items
- [ ] Add confidence scoring per extracted field
- [ ] Add extractor regression tests with sample PDFs/images

## 3) Policy Agent (Agent 02 Policy RAG)

- ✅ Initial policy analysis step wired in extractor flow
- ✅ Basic policy rule checks implemented (coverage/allowed meds/incomplete)
- [ ] Implement dedicated Policy Agent module under app/agents/policy/
- [ ] Add disease-level matching against disease_sub_limits
- [ ] Enforce waiting-period waterfall: disease-specific override, else global waiting
- [ ] Enforce sub-limit checks: max_payable_inr and max_hospitalization_days_allowed
- [ ] Enforce protocol checks: max_diagnostic_tests_per_day and max_pharmacy_dosages_per_day
- [ ] Emit policy citations and machine-readable rule evidence in output
- [ ] Add API support for policy endpoints in roadmap: GET /api/policies and GET /api/policies/:id/clauses

## 4) Fraud Investigator (Agent 03)

- ✅ Fraud decision endpoint exists (POST /api/fraud/decision)
- ✅ Deterministic fraud scoring engine implemented
- ✅ Rule signals for missing fields, high amount, OCR quality, and pattern hits implemented
- [ ] Implement dedicated Investigator Agent module under app/agents/investigator/
- [ ] Add duplicate-claim detection using patient_id + diagnosis + time window
- [ ] Add tests/day fraud check from roadmap: tests_per_day > max_diagnostic_tests_per_day
- [ ] Add sub-limit bust fraud signal: amount > max_payable_inr
- [ ] Add field-verification trigger: amount > requires_field_verification_above_inr
- [ ] Add Isolation Forest anomaly scoring with feature pipeline
- [ ] Add explainable fraud evidence array with rule id, value, threshold
- [ ] Add roadmap endpoint: GET /api/fraud/alerts

## 5) Mediator And Final Decision (Agent 04)

- [ ] Implement dedicated Mediator Agent module under app/agents/mediator/
- [ ] Aggregate policy + fraud outputs into final decision packet
- [ ] Generate approved_amount and final status
- [ ] Generate patient decision letter (plain-language)
- [ ] Generate insurer summary (audit-ready)
- [ ] Generate hospital query for missing documents
- [ ] Add API endpoint for communication dispatch: POST /api/claims/:id/email

## 6) Claims API And Persistence

- [ ] Implement claims create endpoint: POST /api/claims
- [ ] Implement claim read endpoint: GET /api/claims/:id
- [ ] Implement claim decision update endpoint: PUT /api/claims/:id/decision
- [ ] Implement claim document upload endpoint: POST /api/claims/:id/document
- [ ] Implement claim delete endpoint: DEL /api/claims/:id
- [ ] Implement DB models for policies, global_conditions, disease_sub_limits, claims
- [ ] Persist agent outputs in claim.aiResults JSON with audit trail fields

## 7) Cross-Validation Rules Using mock_policies.json

- [ ] Validate diagnosis exists in disease_sub_limits
- [ ] Validate claim amount against max_payable_inr
- [ ] Validate hospitalization days against max_hospitalization_days_allowed
- [ ] Validate diagnostic tests/day against max_diagnostic_tests_per_day
- [ ] Validate pharmacy dosage/day against max_pharmacy_dosages_per_day
- [ ] Validate waiting period eligibility (specific/global)
- [ ] Trigger field verification above requires_field_verification_above_inr
- [ ] Apply global caps (room_rent_cap_per_day, icu_rent_cap_per_day, ambulance caps, etc.)

## 8) Quality Gates Before Moving Beyond Mediator

- [ ] End-to-end happy-path test: upload -> extractor -> policy -> fraud -> mediator packet
- [ ] End-to-end suspicious-path test: policy pass + fraud flag -> mediator escalation
- [ ] End-to-end rejection-path test: policy violation -> denial packet with reason
- [ ] Add API contract tests for all implemented roadmap endpoints
- [ ] Add sample fixtures for 3-5 diseases from mock policy for deterministic tests

---

## Notes

- This list intentionally focuses on completion till Mediator Agent and decision packet generation.
- Keep using backend/app/db/mock_policies.json as the canonical policy source for cross-validation and fraud flagging until a full policy DB is introduced.

// ─── ClaimHeart Mock Data ─────────────────────────────────────────────────────

export const kpiData = {
  claimsProcessed: 1247,
  approvalRate: 78.4,
  fraudFlags: 23,
  avgProcessingTime: 18,
  revenueSaved: 4820000,
  claimsProcessedDelta: "+12%",
  approvalRateDelta: "+2.1%",
  fraudFlagsDelta: "+5",
  processingTimeDelta: "-3s",
  revenueSavedDelta: "+18%",
};

export const claimsTimelineData = [
  { month: "Sep", claims: 820, approved: 640, denied: 180 },
  { month: "Oct", claims: 940, approved: 730, denied: 210 },
  { month: "Nov", claims: 1020, approved: 800, denied: 220 },
  { month: "Dec", claims: 1100, approved: 860, denied: 240 },
  { month: "Jan", claims: 1180, approved: 920, denied: 260 },
  { month: "Feb", claims: 1247, approved: 978, denied: 269 },
];

export const denialReasonsData = [
  { reason: "Pre-existing", count: 87 },
  { reason: "Sub-limit", count: 62 },
  { reason: "Missing Docs", count: 54 },
  { reason: "Upcoding", count: 38 },
  { reason: "Waiting Period", count: 28 },
];

export const fraudTypeData = [
  { name: "Ghost Billing", value: 34, color: "#EF4444" },
  { name: "Upcoding", value: 28, color: "#F59E0B" },
  { name: "Non-Disclosure", value: 22, color: "#7FAEE3" },
  { name: "Bill Inflation", value: 16, color: "#4A8EDB" },
];

export const agentStatus = [
  { name: "Extractor Agent", status: "active", processedToday: 1247, accuracy: 98.2, latency: "1.2s" },
  { name: "Policy Agent", status: "active", processedToday: 1195, accuracy: 96.8, latency: "2.8s" },
  { name: "Fraud Agent", status: "active", processedToday: 1247, accuracy: 94.1, latency: "3.4s" },
  { name: "Mediator Agent", status: "active", processedToday: 1247, accuracy: 97.5, latency: "1.8s" },
];

export type ClaimStatus = "approved" | "denied" | "pending" | "fraud" | "escalated";

export interface Claim {
  id: string;
  patient: string;
  patientId: string;
  provider: string;
  amount: number;
  amountApproved: number;
  diagnosis: string;
  icd10: string;
  aiConfidence: number;
  fraudScore: number;
  status: ClaimStatus;
  date: string;
  policyType: "retail" | "corporate";
  policyNumber: string;
  hospitalizationDays: number;
  doctor: string;
  city: string;
  fraudFindings: string[];
  policyMatches: { clause: string; section: string; page: number; match: string }[];
  timeline: { time: string; event: string; status: "done" | "current" | "pending" }[];
  mediatorNote: string;
  extractedData: Record<string, string | number | string[]>;
}

export const claims: Claim[] = [
  {
    id: "CLM-2026-01247",
    patient: "Rajesh Kumar",
    patientId: "MH-2026-00412",
    provider: "Kokilaben Dhirubhai Ambani Hospital",
    amount: 85000,
    amountApproved: 60000,
    diagnosis: "Tympanoplasty — Right Ear",
    icd10: "H72.01",
    aiConfidence: 92,
    fraudScore: 0.12,
    status: "approved",
    date: "2026-01-15",
    policyType: "retail",
    policyNumber: "CARE-XYZ-78234",
    hospitalizationDays: 2,
    doctor: "Dr. Anjali Mehta",
    city: "Mumbai",
    fraudFindings: [],
    policyMatches: [
      { clause: "Tympanoplasty is covered under surgical procedures.", section: "Section 5.1", page: 11, match: "Covered — ₹60,000 approved" },
      { clause: "Room entitlement: General ward ₹3,000/day. Premium room not covered.", section: "Section 6.1", page: 12, match: "Room differential ₹17,500 denied" },
      { clause: "Lab tests beyond clinical protocol: patient's plan covers 3 tests.", section: "Section 7.3", page: 15, match: "3 extra tests ₹7,500 denied" },
    ],
    timeline: [
      { time: "Jan 15, 10:02 AM", event: "Pre-auth form received", status: "done" },
      { time: "Jan 15, 10:58 AM", event: "Initial approval issued (₹42,500)", status: "done" },
      { time: "Jan 15, 03:15 PM", event: "Discharge documents requested", status: "done" },
      { time: "Jan 15, 06:40 PM", event: "Final approval issued (₹17,500)", status: "done" },
      { time: "Jan 16, 09:00 AM", event: "Reimbursement processed", status: "done" },
    ],
    mediatorNote: "Your claim for tympanoplasty surgery at Kokilaben Hospital has been PARTIALLY APPROVED. ₹60,000 is approved. ₹25,000 was not approved due to room rate differential (₹17,500) and excess lab tests (₹7,500). You may appeal within 15 days by calling 1800-XXX-XXXX.",
    extractedData: {
      patient_id: "MH-2026-00412",
      patient_name: "Rajesh Kumar",
      insurance_card_number: "CARE-XYZ-78234",
      policy_type: "retail",
      policy_start_date: "2024-01-04",
      diagnosis: "Tympanoplasty — right ear",
      icd10_code: "H72.01",
      cpt_codes: ["69631"],
      estimated_cost_inr: 85000,
      hospitalization_days: 2,
      doctor_name: "Dr. Anjali Mehta",
      hospital_name: "Kokilaben Dhirubhai Ambani Hospital",
      past_conditions: ["None disclosed"],
      tests_ordered: ["CBC", "Blood Glucose Fasting", "Audiometry"],
    },
  },
  {
    id: "CLM-2026-01246",
    patient: "Priya Sharma",
    patientId: "DL-2026-00389",
    provider: "Apollo Hospitals, New Delhi",
    amount: 480000,
    amountApproved: 0,
    diagnosis: "Dengue Hemorrhagic Fever",
    icd10: "A91",
    aiConfidence: 94,
    fraudScore: 0.94,
    status: "fraud",
    date: "2026-01-14",
    policyType: "retail",
    policyNumber: "HDFC-ERG-45821",
    hospitalizationDays: 7,
    doctor: "Dr. Vikram Singh",
    city: "New Delhi",
    fraudFindings: [
      "Sub-limit exceeded: Dengue cap is ₹3,00,000 — billed ₹4,80,000 (60% over)",
      "Redundant tests: 5 CBC/day billed vs. protocol max of 2/day",
      "Hospitalization duration: 7 days flagged — clinical avg for Dengue 3–4 days",
      "Cost 480% above regional baseline for Dengue treatment",
    ],
    policyMatches: [
      { clause: "Dengue fever sub-limit: ₹3,00,000 per policy year.", section: "Section 4.2(b)", page: 7, match: "Sub-limit exceeded by ₹1,80,000" },
      { clause: "Diagnostic tests: max 2 CBC tests per day for Dengue monitoring.", section: "Section 7.1", page: 14, match: "3 excess tests/day flagged" },
    ],
    timeline: [
      { time: "Jan 14, 08:30 AM", event: "Pre-auth form received", status: "done" },
      { time: "Jan 14, 09:15 AM", event: "AI fraud detection triggered", status: "done" },
      { time: "Jan 14, 10:00 AM", event: "Escalated to fraud investigation", status: "done" },
      { time: "Jan 14, 02:00 PM", event: "Physical verification agent dispatched", status: "current" },
      { time: "Pending", event: "Final decision", status: "pending" },
    ],
    mediatorNote: "This claim has been flagged with HIGH FRAUD RISK (94.2% confidence). Multiple anomalies detected: billing 60% above the Dengue sub-limit, excessive diagnostic tests, and abnormally long hospitalization. A physical verification agent has been dispatched to Apollo Hospitals. The claim is currently under investigation.",
    extractedData: {
      patient_id: "DL-2026-00389",
      patient_name: "Priya Sharma",
      insurance_card_number: "HDFC-ERG-45821",
      policy_type: "retail",
      policy_start_date: "2023-06-12",
      diagnosis: "Dengue Hemorrhagic Fever",
      icd10_code: "A91",
      cpt_codes: ["99233", "85025", "85025", "85025"],
      estimated_cost_inr: 480000,
      hospitalization_days: 7,
      doctor_name: "Dr. Vikram Singh",
      hospital_name: "Apollo Hospitals, New Delhi",
      past_conditions: ["None disclosed"],
      tests_ordered: ["CBC x5/day", "LFT", "KFT", "PT/INR", "Platelet Count x5/day"],
    },
  },
  {
    id: "CLM-2026-01245",
    patient: "Amit Desai",
    patientId: "MH-2026-00378",
    provider: "Breach Candy Hospital",
    amount: 45000,
    amountApproved: 45000,
    diagnosis: "Appendectomy",
    icd10: "K37",
    aiConfidence: 98,
    fraudScore: 0.04,
    status: "approved",
    date: "2026-01-13",
    policyType: "corporate",
    policyNumber: "STAR-CORP-12345",
    hospitalizationDays: 1,
    doctor: "Dr. Sameer Patel",
    city: "Mumbai",
    fraudFindings: [],
    policyMatches: [
      { clause: "Appendectomy covered under emergency surgical procedures.", section: "Section 3.1", page: 5, match: "Fully covered — ₹45,000" },
      { clause: "Corporate policies: no waiting period applies.", section: "Section 1.2", page: 2, match: "Immediate coverage confirmed" },
    ],
    timeline: [
      { time: "Jan 13, 11:20 AM", event: "Emergency pre-auth received", status: "done" },
      { time: "Jan 13, 12:10 PM", event: "Initial approval issued", status: "done" },
      { time: "Jan 13, 07:30 PM", event: "Discharge approval issued", status: "done" },
      { time: "Jan 14, 10:00 AM", event: "Payment processed to hospital", status: "done" },
    ],
    mediatorNote: "Your claim for Appendectomy at Breach Candy Hospital has been FULLY APPROVED. ₹45,000 has been directly credited to the hospital. No action needed from your side.",
    extractedData: {
      patient_id: "MH-2026-00378",
      patient_name: "Amit Desai",
      insurance_card_number: "STAR-CORP-12345",
      policy_type: "corporate",
      policy_start_date: "2025-04-01",
      diagnosis: "Appendectomy",
      icd10_code: "K37",
      cpt_codes: ["44950"],
      estimated_cost_inr: 45000,
      hospitalization_days: 1,
      doctor_name: "Dr. Sameer Patel",
      hospital_name: "Breach Candy Hospital",
      past_conditions: ["None disclosed"],
      tests_ordered: ["CBC", "CRP", "Ultrasound Abdomen"],
    },
  },
  {
    id: "CLM-2026-01244",
    patient: "Manish Gupta",
    patientId: "KA-2026-00301",
    provider: "Manipal Hospital, Bangalore",
    amount: 320000,
    amountApproved: 0,
    diagnosis: "Cardiac Bypass Surgery (CABG)",
    icd10: "Z95.1",
    aiConfidence: 96,
    fraudScore: 0.82,
    status: "denied",
    date: "2026-01-12",
    policyType: "retail",
    policyNumber: "CARE-RET-99012",
    hospitalizationDays: 6,
    doctor: "Dr. Suresh Nair",
    city: "Bangalore",
    fraudFindings: [
      "Pre-existing condition detected: Heart disease documented Dec 2024 — policy purchased Jan 2026",
      "Retail policy waiting period violation: 2-year minimum not fulfilled",
      "Material non-disclosure at policy inception",
    ],
    policyMatches: [
      { clause: "Retail policies require a 2-year waiting period for pre-existing conditions.", section: "Section 2.3", page: 4, match: "Waiting period violated — policy 0.9 years old" },
      { clause: "Material non-disclosure: policy may be terminated.", section: "Section 10.1", page: 21, match: "Non-disclosure of pre-existing heart condition" },
    ],
    timeline: [
      { time: "Jan 12, 09:00 AM", event: "Pre-auth form received", status: "done" },
      { time: "Jan 12, 09:45 AM", event: "Pre-existing condition detected by AI", status: "done" },
      { time: "Jan 12, 10:30 AM", event: "Claim denied — waiting period violation", status: "done" },
      { time: "Jan 12, 11:00 AM", event: "Patient notified with explanation", status: "done" },
    ],
    mediatorNote: "Your claim for Cardiac Bypass Surgery has been DENIED. Our AI system detected that heart disease was documented in your medical records from December 2024. Your retail policy was purchased on January 4, 2026 — the 2-year waiting period for pre-existing conditions has not been fulfilled. Additionally, this condition was not disclosed at the time of policy purchase (Section 10.1, Page 21). You may appeal this decision by calling 1800-XXX-XXXX.",
    extractedData: {
      patient_id: "KA-2026-00301",
      patient_name: "Manish Gupta",
      insurance_card_number: "CARE-RET-99012",
      policy_type: "retail",
      policy_start_date: "2026-01-04",
      diagnosis: "Cardiac Bypass Surgery (CABG)",
      icd10_code: "Z95.1",
      cpt_codes: ["33533", "33534"],
      estimated_cost_inr: 320000,
      hospitalization_days: 6,
      doctor_name: "Dr. Suresh Nair",
      hospital_name: "Manipal Hospital, Bangalore",
      past_conditions: ["Coronary artery disease (Dec 2024)", "Hypertension"],
      tests_ordered: ["ECG", "Echo", "Cardiac Catheterization", "CBC", "Coagulation Profile"],
    },
  },
  {
    id: "CLM-2026-01243",
    patient: "Sunita Rao",
    patientId: "TN-2026-00265",
    provider: "Fortis Malar Hospital, Chennai",
    amount: 95000,
    amountApproved: 0,
    diagnosis: "Knee Replacement (TKR)",
    icd10: "Z96.651",
    aiConfidence: 88,
    fraudScore: 0.21,
    status: "pending",
    date: "2026-01-16",
    policyType: "retail",
    policyNumber: "NIVA-RET-33291",
    hospitalizationDays: 4,
    doctor: "Dr. Rajan Iyer",
    city: "Chennai",
    fraudFindings: [],
    policyMatches: [
      { clause: "Joint replacement covered after 2-year waiting period.", section: "Section 5.4", page: 10, match: "Waiting period: fulfilled (policy 3.2 years)" },
      { clause: "Orthopedic implant sub-limit: ₹80,000.", section: "Section 4.6", page: 8, match: "Implant cost ₹82,000 — ₹2,000 excess" },
    ],
    timeline: [
      { time: "Jan 16, 08:00 AM", event: "Pre-auth form received", status: "done" },
      { time: "Jan 16, 09:30 AM", event: "AI processing complete", status: "done" },
      { time: "Jan 16, 10:15 AM", event: "Policy review — sub-limit check", status: "current" },
      { time: "Pending", event: "Initial approval decision", status: "pending" },
    ],
    mediatorNote: "Your claim for Total Knee Replacement at Fortis Malar Hospital is currently being reviewed. The policy waiting period has been satisfied. A minor sub-limit issue for the orthopedic implant (₹2,000 excess) is being evaluated. We expect a decision within 1 hour.",
    extractedData: {
      patient_id: "TN-2026-00265",
      patient_name: "Sunita Rao",
      insurance_card_number: "NIVA-RET-33291",
      policy_type: "retail",
      policy_start_date: "2022-11-15",
      diagnosis: "Total Knee Replacement (TKR)",
      icd10_code: "Z96.651",
      cpt_codes: ["27447"],
      estimated_cost_inr: 95000,
      hospitalization_days: 4,
      doctor_name: "Dr. Rajan Iyer",
      hospital_name: "Fortis Malar Hospital, Chennai",
      past_conditions: ["Osteoarthritis (2020)"],
      tests_ordered: ["X-Ray Knee", "CBC", "BMP", "Coagulation", "Echo"],
    },
  },
  {
    id: "CLM-2026-01242",
    patient: "Arjun Mehta",
    patientId: "GJ-2026-00198",
    provider: "Shri Ram Clinic, Ahmedabad",
    amount: 240000,
    amountApproved: 0,
    diagnosis: "General Surgery (Hernia Repair)",
    icd10: "K40.9",
    aiConfidence: 97,
    fraudScore: 0.96,
    status: "escalated",
    date: "2026-01-11",
    policyType: "retail",
    policyNumber: "BAJAJ-AL-78834",
    hospitalizationDays: 5,
    doctor: "Dr. Harsh Kapoor",
    city: "Ahmedabad",
    fraudFindings: [
      "Ghost billing detected: 4 separate claims filed for same patient ID on same admission date",
      "Cost 480% above regional baseline (₹240,000 vs avg ₹50,000)",
      "Duplicate PL/AL number used across multiple claim submissions",
      "Provider flagged in 2 prior investigations",
    ],
    policyMatches: [
      { clause: "Hernia repair covered under day-care/short-stay procedures.", section: "Section 5.2", page: 11, match: "Covered up to ₹60,000" },
    ],
    timeline: [
      { time: "Jan 11, 10:00 AM", event: "Claim received (Claim #1 of 4)", status: "done" },
      { time: "Jan 11, 10:15 AM", event: "Duplicate claims detected (x4 same patient)", status: "done" },
      { time: "Jan 11, 10:30 AM", event: "Escalated to Senior Investigator", status: "done" },
      { time: "Jan 11, 02:00 PM", event: "Police complaint filed", status: "current" },
      { time: "Pending", event: "Resolution", status: "pending" },
    ],
    mediatorNote: "CRITICAL FRAUD ALERT: This claim has been escalated due to ghost billing. 4 separate claims were submitted using the same patient insurance ID for a single admission. The total billed amount (₹2,40,000) is 480% above the regional average for hernia repair (₹50,000). This case has been referred to the Special Investigation Unit and authorities have been notified.",
    extractedData: {
      patient_id: "GJ-2026-00198",
      patient_name: "Arjun Mehta",
      insurance_card_number: "BAJAJ-AL-78834",
      policy_type: "retail",
      policy_start_date: "2024-03-20",
      diagnosis: "Hernia Repair (Laparoscopic)",
      icd10_code: "K40.9",
      cpt_codes: ["49650", "49650", "49650", "49650"],
      estimated_cost_inr: 240000,
      hospitalization_days: 5,
      doctor_name: "Dr. Harsh Kapoor",
      hospital_name: "Shri Ram Clinic, Ahmedabad",
      past_conditions: ["None disclosed"],
      tests_ordered: ["CBC", "LFT", "USG Abdomen", "X-Ray Chest"],
    },
  },
  {
    id: "CLM-2026-01241",
    patient: "Deepa Nair",
    patientId: "KL-2026-00155",
    provider: "KIMS Hospital, Thiruvananthapuram",
    amount: 62000,
    amountApproved: 62000,
    diagnosis: "Laparoscopic Cholecystectomy",
    icd10: "K80.20",
    aiConfidence: 99,
    fraudScore: 0.03,
    status: "approved",
    date: "2026-01-10",
    policyType: "corporate",
    policyNumber: "RELIANCE-CORP-55781",
    hospitalizationDays: 1,
    doctor: "Dr. Anoop Varma",
    city: "Thiruvananthapuram",
    fraudFindings: [],
    policyMatches: [
      { clause: "Laparoscopic cholecystectomy covered as day-care procedure.", section: "Section 5.3", page: 11, match: "Fully covered — ₹62,000" },
    ],
    timeline: [
      { time: "Jan 10, 07:00 AM", event: "Pre-auth received", status: "done" },
      { time: "Jan 10, 07:55 AM", event: "Approved within TAT", status: "done" },
      { time: "Jan 10, 06:00 PM", event: "Discharge approved", status: "done" },
      { time: "Jan 11, 09:00 AM", event: "Payment to hospital", status: "done" },
    ],
    mediatorNote: "Your claim for Laparoscopic Cholecystectomy has been FULLY APPROVED and ₹62,000 has been paid directly to KIMS Hospital. No further action needed.",
    extractedData: {
      patient_id: "KL-2026-00155",
      patient_name: "Deepa Nair",
      insurance_card_number: "RELIANCE-CORP-55781",
      policy_type: "corporate",
      policy_start_date: "2025-01-01",
      diagnosis: "Gallstones — Laparoscopic Cholecystectomy",
      icd10_code: "K80.20",
      cpt_codes: ["47562"],
      estimated_cost_inr: 62000,
      hospitalization_days: 1,
      doctor_name: "Dr. Anoop Varma",
      hospital_name: "KIMS Hospital, Thiruvananthapuram",
      past_conditions: ["None"],
      tests_ordered: ["CBC", "LFT", "USG Abdomen"],
    },
  },
  {
    id: "CLM-2026-01240",
    patient: "Ravi Shankar",
    patientId: "UP-2026-00099",
    provider: "MediCare Plus, Lucknow",
    amount: 175000,
    amountApproved: 0,
    diagnosis: "Fever with Complications",
    icd10: "R50.9",
    aiConfidence: 91,
    fraudScore: 0.88,
    status: "fraud",
    date: "2026-01-09",
    policyType: "retail",
    policyNumber: "IFFCO-RET-21099",
    hospitalizationDays: 12,
    doctor: "Dr. Raju Verma",
    city: "Lucknow",
    fraudFindings: [
      "Hospitalization 12 days for fever — clinical standard 2–3 days",
      "Cost ₹1,75,000 vs regional baseline ₹40,000–₹50,000 (350% above)",
      "Room charges: ICU billed for standard fever case",
      "Unnecessary invasive procedures billed",
    ],
    policyMatches: [
      { clause: "Fever treatment: standard tariff ₹40,000–50,000 for non-complex cases.", section: "Section 4.1", page: 7, match: "Bill 350% above tariff benchmark" },
      { clause: "ICU admission requires documented clinical necessity.", section: "Section 8.2", page: 17, match: "ICU medical necessity not established" },
    ],
    timeline: [
      { time: "Jan 9, 10:00 AM", event: "Claim received", status: "done" },
      { time: "Jan 9, 10:30 AM", event: "Statistical anomaly detected", status: "done" },
      { time: "Jan 9, 11:00 AM", event: "Flagged as HIGH RISK fraud", status: "done" },
      { time: "Jan 9, 02:00 PM", event: "Under investigation", status: "current" },
    ],
    mediatorNote: "FRAUD ALERT: This claim has been flagged as HIGH RISK. Hospitalization of 12 days for a fever diagnosis is significantly above the clinical standard. The total bill of ₹1,75,000 is 350% above the regional average. ICU charges have been billed without documented clinical necessity. This case is under investigation.",
    extractedData: {
      patient_id: "UP-2026-00099",
      patient_name: "Ravi Shankar",
      insurance_card_number: "IFFCO-RET-21099",
      policy_type: "retail",
      policy_start_date: "2024-07-01",
      diagnosis: "Fever with complications",
      icd10_code: "R50.9",
      cpt_codes: ["99232", "99233", "99233", "99233"],
      estimated_cost_inr: 175000,
      hospitalization_days: 12,
      doctor_name: "Dr. Raju Verma",
      hospital_name: "MediCare Plus, Lucknow",
      past_conditions: ["None disclosed"],
      tests_ordered: ["CBC x3/day", "LFT", "KFT", "Cultures x4", "CT Chest", "MRI Brain"],
    },
  },
];

export const fraudAlerts = [
  {
    id: "FA-2026-0089",
    claimId: "CLM-2026-01246",
    patient: "Priya Sharma",
    provider: "Apollo Hospitals, New Delhi",
    score: 0.94,
    type: "Bill Inflation + Redundant Tests",
    amount: 480000,
    status: "Under Investigation",
    severity: "critical",
    detectedAt: "Jan 14, 2026",
  },
  {
    id: "FA-2026-0088",
    claimId: "CLM-2026-01242",
    patient: "Arjun Mehta",
    provider: "Shri Ram Clinic, Ahmedabad",
    score: 0.96,
    type: "Ghost Billing (×4 Duplicate)",
    amount: 240000,
    status: "Escalated",
    severity: "critical",
    detectedAt: "Jan 11, 2026",
  },
  {
    id: "FA-2026-0087",
    claimId: "CLM-2026-01240",
    patient: "Ravi Shankar",
    provider: "MediCare Plus, Lucknow",
    score: 0.88,
    type: "Unnecessary Admission + ICU Fraud",
    amount: 175000,
    status: "Flagged",
    severity: "high",
    detectedAt: "Jan 9, 2026",
  },
  {
    id: "FA-2026-0086",
    claimId: "CLM-2026-01244",
    patient: "Manish Gupta",
    provider: "Manipal Hospital, Bangalore",
    score: 0.82,
    type: "Pre-existing Non-Disclosure",
    amount: 320000,
    status: "Denied",
    severity: "high",
    detectedAt: "Jan 12, 2026",
  },
  {
    id: "FA-2026-0085",
    claimId: "CLM-2026-01238",
    patient: "Kavya Krishnan",
    provider: "Sri Balaji Medical Centre, Hyderabad",
    score: 0.73,
    type: "Upcoding — CPT Mismatch",
    amount: 95000,
    status: "Under Review",
    severity: "medium",
    detectedAt: "Jan 8, 2026",
  },
  {
    id: "FA-2026-0084",
    claimId: "CLM-2026-01235",
    patient: "Pooja Menon",
    provider: "Aster CMI Hospital, Bangalore",
    score: 0.69,
    type: "Phantom Services",
    amount: 58000,
    status: "Under Review",
    severity: "medium",
    detectedAt: "Jan 7, 2026",
  },
];

export const fraudScatterData = [
  { claimAmount: 480000, fraudScore: 0.94, type: "Bill Inflation", id: "CLM-01246" },
  { claimAmount: 240000, fraudScore: 0.96, type: "Ghost Billing", id: "CLM-01242" },
  { claimAmount: 175000, fraudScore: 0.88, type: "Unnecessary Admission", id: "CLM-01240" },
  { claimAmount: 320000, fraudScore: 0.82, type: "Non-Disclosure", id: "CLM-01244" },
  { claimAmount: 95000, fraudScore: 0.73, type: "Upcoding", id: "CLM-01238" },
  { claimAmount: 58000, fraudScore: 0.69, type: "Phantom Services", id: "CLM-01235" },
  { claimAmount: 85000, fraudScore: 0.12, type: "Clean", id: "CLM-01247" },
  { claimAmount: 45000, fraudScore: 0.04, type: "Clean", id: "CLM-01245" },
  { claimAmount: 62000, fraudScore: 0.03, type: "Clean", id: "CLM-01241" },
  { claimAmount: 120000, fraudScore: 0.45, type: "Review", id: "CLM-01239" },
  { claimAmount: 38000, fraudScore: 0.18, type: "Clean", id: "CLM-01237" },
  { claimAmount: 210000, fraudScore: 0.61, type: "Upcoding", id: "CLM-01236" },
];

export const policies = [
  {
    id: "POL-001",
    name: "Care Health Insurance — Comprehensive Plan 2024",
    insurer: "Care Health Insurance",
    version: "v2024.2",
    pages: 34,
    lastUpdated: "Jan 2026",
    clauses: [
      { section: "Section 2.3", title: "Waiting Period Rules", page: 4, summary: "Retail policies: 2-year minimum waiting period for pre-existing conditions. Corporate plans: no waiting period.", highlighted: true },
      { section: "Section 3.1", title: "Cashless Settlement", page: 5, summary: "Cashless facility available at 10,000+ network hospitals. Pre-authorization mandatory within 4 hours of admission.", highlighted: false },
      { section: "Section 4.2(b)", title: "Dengue Sub-limit", page: 7, summary: "Dengue fever treatment capped at ₹3,00,000 per policy year. Excess billing to be borne by the insured.", highlighted: true },
      { section: "Section 5.1", title: "Surgical Procedures", page: 11, summary: "All listed surgical procedures covered as per Schedule II. Non-listed procedures require prior approval.", highlighted: false },
      { section: "Section 6.1", title: "Room Entitlement", page: 12, summary: "General ward: ₹3,000/day. Single AC room: ₹5,000/day. ICU/ICCU: actuals as per policy variant.", highlighted: true },
      { section: "Section 7.1", title: "Diagnostic Tests", page: 14, summary: "Diagnostic tests must be prescribed by attending physician. Protocol limits apply per disease category.", highlighted: false },
      { section: "Section 10.1", title: "Non-Disclosure Policy", page: 21, summary: "Material non-disclosure of pre-existing conditions at policy inception may result in claim rejection and policy termination.", highlighted: true },
    ],
    aiNote: "This policy has 3 clauses flagged as high-risk for denial: Dengue sub-limit (4.2b), Room entitlement (6.1), and Non-disclosure (10.1). Recommend auto-checking these on every claim ingestion.",
  },
  {
    id: "POL-002",
    name: "HDFC ERGO Optima Restore — Individual Plan",
    insurer: "HDFC ERGO",
    version: "v2025.1",
    pages: 42,
    lastUpdated: "Mar 2025",
    clauses: [
      { section: "Section 1.2", title: "Corporate Coverage", page: 2, summary: "No waiting period for corporate group plans. Immediate coverage from Day 1 of employment.", highlighted: false },
      { section: "Section 4.6", title: "Orthopedic Implants", page: 8, summary: "Orthopedic implants covered up to ₹80,000. Excess cost to be borne by the patient.", highlighted: true },
      { section: "Section 5.4", title: "Joint Replacement", page: 10, summary: "Hip/Knee joint replacement: 2-year waiting period for retail policies. Covered after fulfillment.", highlighted: false },
      { section: "Section 8.2", title: "ICU Admission", page: 17, summary: "ICU admission requires documented clinical necessity certified by treating physician.", highlighted: true },
    ],
    aiNote: "Orthopedic implant sub-limit (4.6) is commonly the cause of partial claim approvals. ICU necessity documentation (8.2) is a frequent fraud vector.",
  },
  {
    id: "POL-003",
    name: "Star Health Family Health Optima",
    insurer: "Star Health",
    version: "v2024.3",
    pages: 28,
    lastUpdated: "Dec 2024",
    clauses: [
      { section: "Section 2.1", title: "Pre-existing Conditions", page: 3, summary: "Pre-existing conditions covered after 48 months (4-year waiting period) for retail policies.", highlighted: true },
      { section: "Section 5.2", title: "Day-care Procedures", page: 11, summary: "Listed day-care procedures (e.g., laparoscopic cholecystectomy, hernia repair) covered without minimum hospitalization.", highlighted: false },
      { section: "Section 9.1", title: "Maternity Benefits", page: 18, summary: "Maternity coverage available after 9-month waiting period. Normal delivery ₹30,000, C-section ₹50,000.", highlighted: false },
    ],
    aiNote: "Star Health has a 4-year waiting period for pre-existing conditions — longer than industry standard. Flag all retail claims for waiting period compliance.",
  },
];

export const reportsData = {
  processingSpeed: 18,
  fraudPrevented: 4820000,
  costPerClaim: 142,
  accuracyRate: 97.2,
  monthlyTrends: [
    { month: "Sep", processed: 820, fraudDetected: 14, saved: 2800000, accuracy: 95.1 },
    { month: "Oct", processed: 940, fraudDetected: 17, saved: 3100000, accuracy: 95.8 },
    { month: "Nov", processed: 1020, fraudDetected: 19, saved: 3600000, accuracy: 96.2 },
    { month: "Dec", processed: 1100, fraudDetected: 20, saved: 3900000, accuracy: 96.7 },
    { month: "Jan", processed: 1180, fraudDetected: 22, saved: 4400000, accuracy: 97.0 },
    { month: "Feb", processed: 1247, fraudDetected: 23, saved: 4820000, accuracy: 97.2 },
  ],
  icdUsage: [
    { code: "K80.20", description: "Gallstones", count: 142 },
    { code: "H72.01", description: "Tympanoplasty", count: 128 },
    { code: "K40.9", description: "Hernia", count: 115 },
    { code: "K37", description: "Appendicitis", count: 98 },
    { code: "A91", description: "Dengue", count: 87 },
    { code: "Z96.651", description: "Knee Replacement", count: 74 },
    { code: "Z95.1", description: "CABG", count: 62 },
    { code: "R50.9", description: "Fever", count: 201 },
  ],
};

export const formatCurrency = (amount: number, currency: string = "₹"): string => {
  if (amount >= 100000) {
    return `${currency}${(amount / 100000).toFixed(2)}L`;
  }
  return `${currency}${amount.toLocaleString("en-IN")}`;
};

export const getStatusColor = (status: ClaimStatus): string => {
  switch (status) {
    case "approved": return "text-green-600 bg-green-50 border-green-200";
    case "denied": return "text-red-600 bg-red-50 border-red-200";
    case "pending": return "text-amber-600 bg-amber-50 border-amber-200";
    case "fraud": return "text-red-700 bg-red-100 border-red-300";
    case "escalated": return "text-orange-600 bg-orange-50 border-orange-200";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
};

export const getFraudScoreColor = (score: number): string => {
  if (score >= 0.8) return "text-red-600";
  if (score >= 0.6) return "text-orange-500";
  if (score >= 0.4) return "text-amber-500";
  return "text-green-600";
};

export const getFraudScoreBg = (score: number): string => {
  if (score >= 0.8) return "bg-red-500";
  if (score >= 0.6) return "bg-orange-400";
  if (score >= 0.4) return "bg-amber-400";
  return "bg-green-500";
};

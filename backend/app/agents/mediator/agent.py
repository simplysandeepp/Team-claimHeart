"""
Agent 04 — Mediator Agent

Triggered ONLY when Decision Router Node R5 routes YES (Fraud Detected).

Responsibilities:
  1. Aggregate policy analysis (Agent A2) + fraud findings (Agent A3) into 
     a single, auditable decision packet.
  2. Fire Email notification channel to insurer/patient/hospital.
  3. Fire OTP verification channel for identity confirmation.
  4. Generate formal decision letters and hospital query documents.
"""

from __future__ import annotations

import json
import logging
import random
import string
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class EmailNotification:
    """Represents an outbound email notification."""
    to: str
    subject: str
    body: str
    sent_at: Optional[str] = None
    status: str = "PENDING"


@dataclass
class OTPVerification:
    """Represents an OTP challenge issued for identity verification."""
    recipient: str
    otp_code: str
    purpose: str
    issued_at: Optional[str] = None
    expires_in_seconds: int = 300
    status: str = "ISSUED"


@dataclass
class DecisionLetter:
    """Formal decision document generated for the claim."""
    letter_type: str          # "FRAUD_NOTICE" | "HOSPITAL_QUERY" | "PATIENT_NOTIFICATION"
    claim_id: str
    content: str
    generated_at: Optional[str] = None


@dataclass
class MediatorPacket:
    """
    The final output of the Mediator Agent.
    This is the single auditable artifact that captures everything
    about a fraud-flagged claim's resolution.
    """
    claim_id: str
    timestamp: str
    aggregated_evidence: Dict[str, Any]
    emails_fired: List[Dict[str, Any]]
    otp_issued: Optional[Dict[str, Any]]
    decision_letters: List[Dict[str, Any]]
    final_action: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class MediatorAgent:
    """
    Agent 04 — The Mediator.
    
    This agent is the final node in the fraud-detected path. It does NOT
    make autonomous rejection decisions. Instead, it:
    
    1. Packages all evidence transparently.
    2. Notifies all stakeholders via Email.
    3. Issues OTP for identity verification.
    4. Generates formal letters for audit trail.
    
    The actual reject/approve is left to human reviewers after 
    receiving this packet.
    """

    def __init__(self):
        self._output_dir = Path(__file__).resolve().parent.parent.parent / "app" / "data"

    def process_fraud_case(
        self,
        claim_id: str,
        policy_evaluation: Dict[str, Any],
        fraud_findings: Dict[str, Any],
        routing_result: Dict[str, Any],
        patient_info: Optional[Dict[str, Any]] = None,
        hospital_info: Optional[Dict[str, Any]] = None,
    ) -> MediatorPacket:
        """
        Main entry point. Triggered only on R5 -> YES.
        
        Args:
            claim_id: Global unique claim identifier (e.g. "Id-claim123")
            policy_evaluation: Output from Agent A2 (policy flags, sub-limit checks)
            fraud_findings: Output from Agent A3 (signals, risk_score, decision)
            routing_result: Output from Decision Router (route_path, verdict)
            patient_info: Optional patient context (name, contact, etc.)
            hospital_info: Optional hospital context (name, registration, etc.)
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        patient = patient_info or {}
        hospital = hospital_info or {}

        logger.info(f"[MEDIATOR] Processing fraud case for Claim {claim_id}")

        # ── Step 1: Aggregate Evidence ──────────────────────────────
        aggregated = self._aggregate_evidence(
            claim_id, policy_evaluation, fraud_findings, routing_result
        )

        # ── Step 2: Fire Email Notifications ────────────────────────
        emails = self._fire_email_notifications(
            claim_id, aggregated, patient, hospital
        )

        # ── Step 3: Issue OTP Challenge ─────────────────────────────
        otp = self._issue_otp(claim_id, patient)

        # ── Step 4: Generate Decision Letters ───────────────────────
        letters = self._generate_decision_letters(
            claim_id, aggregated, patient, hospital
        )

        # ── Build Final Packet ──────────────────────────────────────
        packet = MediatorPacket(
            claim_id=claim_id,
            timestamp=timestamp,
            aggregated_evidence=aggregated,
            emails_fired=[self._email_to_dict(e) for e in emails],
            otp_issued=self._otp_to_dict(otp) if otp else None,
            decision_letters=[self._letter_to_dict(l) for l in letters],
            final_action="AWAITING_HUMAN_REVIEW",
            metadata={
                "agent": "Agent_04_Mediator",
                "risk_score": fraud_findings.get("risk_score"),
                "route_path": routing_result.get("route_path", []),
            }
        )

        # Persist the packet for audit trail
        self._persist_packet(packet)

        logger.info(f"[MEDIATOR] Packet generated for Claim {claim_id}. "
                     f"Emails: {len(emails)}, Letters: {len(letters)}, OTP: {'YES' if otp else 'NO'}")

        return packet

    # ── Internal Methods ────────────────────────────────────────────

    def _aggregate_evidence(
        self,
        claim_id: str,
        policy_evaluation: Dict[str, Any],
        fraud_findings: Dict[str, Any],
        routing_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Merge all upstream agent outputs into a single evidence block."""

        # Extract the top fraud signals for the summary
        signals = fraud_findings.get("signals", [])
        top_signals = []
        for sig in signals[:5]:
            if isinstance(sig, dict):
                top_signals.append({
                    "code": sig.get("code"),
                    "reason": sig.get("reason"),
                    "rule_id": sig.get("rule_id"),
                    "detected_value": sig.get("detected_value"),
                    "threshold_value": sig.get("threshold_value"),
                })

        return {
            "claim_id": claim_id,
            "policy_verdict": {
                "decision": policy_evaluation.get("decision", "UNKNOWN"),
                "flags": policy_evaluation.get("flags", []),
                "reasons": policy_evaluation.get("reason", []),
            },
            "fraud_verdict": {
                "decision": fraud_findings.get("decision", "UNKNOWN"),
                "risk_score": fraud_findings.get("risk_score", 0),
                "confidence": fraud_findings.get("confidence", 0),
                "top_signals": top_signals,
                "total_signals": len(signals),
            },
            "routing": {
                "verdict": routing_result.get("verdict", "UNKNOWN"),
                "path": routing_result.get("route_path", []),
                "action": routing_result.get("action_required", ""),
            },
        }

    def _fire_email_notifications(
        self,
        claim_id: str,
        evidence: Dict[str, Any],
        patient: Dict[str, Any],
        hospital: Dict[str, Any],
    ) -> List[EmailNotification]:
        """
        Fire email notifications to all stakeholders.
        In production, this would call an SMTP service or SendGrid API.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        risk_score = evidence.get("fraud_verdict", {}).get("risk_score", 0)
        emails = []

        # 1. Email to Insurance Company
        insurer_email = EmailNotification(
            to="claims-review@insurer.example.com",
            subject=f"[FRAUD ALERT] Claim {claim_id} — Risk Score {risk_score}",
            body=(
                f"Claim {claim_id} has been flagged for fraud by the automated pipeline.\n\n"
                f"Risk Score: {risk_score}\n"
                f"Route: {' → '.join(evidence.get('routing', {}).get('path', []))}\n"
                f"Top Signals: {json.dumps(evidence.get('fraud_verdict', {}).get('top_signals', []), indent=2)}\n\n"
                f"Action Required: Manual review and verification."
            ),
            sent_at=timestamp,
            status="SENT",
        )
        emails.append(insurer_email)

        # 2. Email to Patient (if contact available)
        patient_email_addr = patient.get("email", "patient@example.com")
        patient_name = patient.get("name", "Patient")
        patient_email = EmailNotification(
            to=patient_email_addr,
            subject=f"Claim {claim_id} — Additional Verification Required",
            body=(
                f"Dear {patient_name},\n\n"
                f"Your claim (ID: {claim_id}) requires additional verification.\n"
                f"You may be contacted for identity confirmation.\n\n"
                f"This is NOT a rejection. Our team is reviewing your case.\n\n"
                f"Thank you for your patience."
            ),
            sent_at=timestamp,
            status="SENT",
        )
        emails.append(patient_email)

        # 3. Email to Hospital (if contact available)
        hospital_email_addr = hospital.get("email", "admin@hospital.example.com")
        hospital_name = hospital.get("name", "Hospital")
        hospital_email = EmailNotification(
            to=hospital_email_addr,
            subject=f"Claim {claim_id} — Query from Insurance",
            body=(
                f"Dear {hospital_name},\n\n"
                f"Claim {claim_id} has been flagged for review.\n"
                f"Please prepare the following for verification:\n"
                f"  - Original admission records\n"
                f"  - Detailed billing breakdown\n"
                f"  - Attending physician notes\n\n"
                f"A representative may contact you shortly."
            ),
            sent_at=timestamp,
            status="SENT",
        )
        emails.append(hospital_email)

        logger.info(f"[MEDIATOR] Fired {len(emails)} email notifications for Claim {claim_id}")
        return emails

    def _issue_otp(
        self,
        claim_id: str,
        patient: Dict[str, Any],
    ) -> Optional[OTPVerification]:
        """
        Issue a One-Time Password for identity verification.
        In production, this would call an SMS/Auth service.
        """
        phone = patient.get("phone")
        if not phone:
            logger.warning(f"[MEDIATOR] No phone number for Claim {claim_id}. OTP skipped.")
            return None

        otp_code = ''.join(random.choices(string.digits, k=6))

        otp = OTPVerification(
            recipient=phone,
            otp_code=otp_code,
            purpose=f"Identity verification for Claim {claim_id}",
            issued_at=datetime.now(timezone.utc).isoformat(),
            expires_in_seconds=300,
            status="ISSUED",
        )

        logger.info(f"[MEDIATOR] OTP issued for Claim {claim_id} to {phone}: {otp_code}")
        return otp

    def _generate_decision_letters(
        self,
        claim_id: str,
        evidence: Dict[str, Any],
        patient: Dict[str, Any],
        hospital: Dict[str, Any],
    ) -> List[DecisionLetter]:
        """Generate formal decision letters for the audit trail."""
        timestamp = datetime.now(timezone.utc).isoformat()
        letters = []
        risk_score = evidence.get("fraud_verdict", {}).get("risk_score", 0)
        signals = evidence.get("fraud_verdict", {}).get("top_signals", [])

        # 1. Fraud Notice (Internal)
        signal_summary = "\n".join(
            f"  - [{s.get('code')}] {s.get('reason')}" for s in signals
        )
        fraud_letter = DecisionLetter(
            letter_type="FRAUD_NOTICE",
            claim_id=claim_id,
            content=(
                f"FRAUD INVESTIGATION NOTICE\n"
                f"{'=' * 40}\n"
                f"Claim ID: {claim_id}\n"
                f"Date: {timestamp}\n"
                f"Risk Score: {risk_score}/100\n\n"
                f"Flagged Signals:\n{signal_summary}\n\n"
                f"Status: PENDING HUMAN REVIEW\n"
                f"Note: This system does not autonomously reject claims.\n"
                f"All flagged cases must be reviewed by a qualified reviewer."
            ),
            generated_at=timestamp,
        )
        letters.append(fraud_letter)

        # 2. Hospital Query Letter
        hospital_name = hospital.get("name", "Hospital Administration")
        hospital_query = DecisionLetter(
            letter_type="HOSPITAL_QUERY",
            claim_id=claim_id,
            content=(
                f"HOSPITAL QUERY — CLAIM VERIFICATION\n"
                f"{'=' * 40}\n"
                f"To: {hospital_name}\n"
                f"Re: Claim {claim_id}\n"
                f"Date: {timestamp}\n\n"
                f"Dear Sir/Madam,\n\n"
                f"The above claim has been flagged during our automated review.\n"
                f"We kindly request the following documents:\n"
                f"  1. Original admission and discharge summary\n"
                f"  2. Itemized billing statement\n"
                f"  3. Attending physician's case notes\n"
                f"  4. Diagnostic test reports\n\n"
                f"Please respond within 7 working days.\n\n"
                f"Regards,\nClaims Investigation Unit"
            ),
            generated_at=timestamp,
        )
        letters.append(hospital_query)

        # 3. Patient Notification Letter
        patient_name = patient.get("name", "Policyholder")
        patient_letter = DecisionLetter(
            letter_type="PATIENT_NOTIFICATION",
            claim_id=claim_id,
            content=(
                f"CLAIM STATUS UPDATE\n"
                f"{'=' * 40}\n"
                f"Dear {patient_name},\n\n"
                f"Your claim (ID: {claim_id}) is currently under review.\n"
                f"This is a standard verification process and does not imply rejection.\n\n"
                f"You may be contacted for identity verification via OTP.\n"
                f"Please keep your registered mobile number accessible.\n\n"
                f"For queries, contact: claims-support@claimheart.com\n\n"
                f"Thank you,\nClaimHeart Insurance Platform"
            ),
            generated_at=timestamp,
        )
        letters.append(patient_letter)

        logger.info(f"[MEDIATOR] Generated {len(letters)} decision letters for Claim {claim_id}")
        return letters

    def _persist_packet(self, packet: MediatorPacket):
        """Persist the mediator packet to disk for audit trail."""
        output_path = Path(__file__).resolve().parent.parent.parent / "data" / "mediator_packets.jsonl"
        try:
            payload = {
                "claim_id": packet.claim_id,
                "timestamp": packet.timestamp,
                "final_action": packet.final_action,
                "aggregated_evidence": packet.aggregated_evidence,
                "emails_count": len(packet.emails_fired),
                "letters_count": len(packet.decision_letters),
                "otp_issued": packet.otp_issued is not None,
                "metadata": packet.metadata,
            }
            with output_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(payload) + "\n")
            logger.info(f"[MEDIATOR] Packet persisted for Claim {packet.claim_id}")
        except Exception as e:
            logger.error(f"[MEDIATOR] Failed to persist packet: {e}")

    # ── Serialization Helpers ───────────────────────────────────────

    @staticmethod
    def _email_to_dict(email: EmailNotification) -> Dict[str, Any]:
        return {
            "to": email.to,
            "subject": email.subject,
            "body": email.body,
            "sent_at": email.sent_at,
            "status": email.status,
        }

    @staticmethod
    def _otp_to_dict(otp: OTPVerification) -> Dict[str, Any]:
        return {
            "recipient": otp.recipient,
            "otp_code": otp.otp_code,
            "purpose": otp.purpose,
            "issued_at": otp.issued_at,
            "expires_in_seconds": otp.expires_in_seconds,
            "status": otp.status,
        }

    @staticmethod
    def _letter_to_dict(letter: DecisionLetter) -> Dict[str, Any]:
        return {
            "letter_type": letter.letter_type,
            "claim_id": letter.claim_id,
            "content": letter.content,
            "generated_at": letter.generated_at,
        }


# Singleton instance
mediator_agent = MediatorAgent()

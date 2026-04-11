from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol

from app.schemas.fraud import (
    ClaimContext,
    DecisionResponse,
    FraudDecision,
    FraudSignal,
    LLMDecisionPayload,
)

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - handled gracefully in runtime paths.
    OpenAI = None  # type: ignore[assignment]


class LLMClient(Protocol):
    def complete(self, prompt: str) -> str:
        ...


@dataclass
class RuleScoreResult:
    risk_score: int
    reasons: List[str]
    signals: List[FraudSignal]
    metadata: Dict[str, Any]


class OpenAIDecisionClient:
    def __init__(self, model: str = "gpt-4o-mini", api_key: Optional[str] = None) -> None:
        if OpenAI is None:
            raise RuntimeError("openai package is not installed")
        resolved_api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not resolved_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        self._client = OpenAI(api_key=resolved_api_key)
        self._model = model

    def complete(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an insurance fraud decision engine. "
                        "Return only valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content or "{}"


class DecisionEngine:
    def __init__(
        self,
        llm_client=None,   # disable LLM
        uncertainty_confidence_threshold: float = 0.65,
    ) -> None:
        self._llm_client = None  # LLM disabled for now
        self._uncertainty_confidence_threshold = uncertainty_confidence_threshold

        # Future me llm enable karna ho to bas yaha llm_client pass kar dena

    def evaluate(self, context: ClaimContext) -> DecisionResponse:
        rule_result = self._compute_rule_risk(context)
        llm_payload = self._evaluate_with_llm(context, rule_result)
        return self._compose_decision(context, rule_result, llm_payload)

    def build_prompt(self, context: ClaimContext, rule_result: RuleScoreResult) -> str:
        compact_context = {
            "claim_data": context.claim_data,
            "policy_rules": context.policy_rules,
            "fraud_patterns": context.fraud_patterns,
            "ocr_text": context.ocr_text,
            "ocr_confidence": context.ocr_confidence,
            "rule_based_risk_score": rule_result.risk_score,
            "rule_based_reasons": rule_result.reasons,
            "signals": [self._model_to_dict(signal) for signal in rule_result.signals],
        }
        instructions = {
            "task": "Determine whether the claim should be APPROVE, FLAG, or REJECT.",
            "constraints": [
                "Return strict JSON only.",
                "Use fields: decision, confidence, reasons.",
                "confidence must be between 0 and 1.",
                "reasons must be a list of concise explanations.",
                "If evidence is incomplete, OCR is noisy, or uncertainty remains, choose FLAG.",
                "Favor explainability and conservatism over creativity.",
            ],
            "json_schema": {
                "decision": "APPROVE | FLAG | REJECT",
                "confidence": "float 0..1",
                "reasons": ["string"],
            },
        }
        return (
            f"{json.dumps(instructions, sort_keys=True)}\n"
            f"{json.dumps(compact_context, sort_keys=True, default=str)}"
        )

        # def _evaluate_with_llm(
        #     self,
        #     context: ClaimContext,
        #     rule_result: RuleScoreResult,
        # ) -> Optional[LLMDecisionPayload]:
        #     if self._llm_client is None:
        #         return None

        #     prompt = self.build_prompt(context, rule_result)
        #     raw_response = self._llm_client.complete(prompt)
        #     return self._parse_llm_response(raw_response)

    def _evaluate_with_llm(self, context, rule_result):
        # Agar future me OpenAI / Gemini use karna ho to yeh function restore kar dena
        return None

    def _parse_llm_response(self, raw_response: str) -> Optional[LLMDecisionPayload]:
        try:
            payload = json.loads(raw_response)
        except json.JSONDecodeError:
            payload = self._extract_json_object(raw_response)
            if payload is None:
                return None

        try:
            return LLMDecisionPayload.parse_obj(payload)
        except Exception:
            return None

    def _extract_json_object(self, raw_response: str) -> Optional[Dict[str, Any]]:
        match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if not match:
            return None

        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    def _compute_rule_risk(self, context: ClaimContext) -> RuleScoreResult:
        signals: List[FraudSignal] = []
        metadata: Dict[str, Any] = {}
        claim_data = context.claim_data or {}

        self._append_if_missing(claim_data, "claim_id", 8, "Claim identifier is missing.", signals)
        self._append_if_missing(claim_data, "patient_id", 10, "Patient identifier is missing.", signals)
        self._append_if_missing(claim_data, "claim_amount", 15, "Claim amount is missing.", signals)
        self._append_if_missing(claim_data, "incident_date", 6, "Incident date is missing.", signals)

        claim_amount = self._coerce_float(claim_data.get("claim_amount"))
        approved_amount = self._coerce_float(claim_data.get("approved_amount"))
        deductible = self._coerce_float(claim_data.get("deductible"))

        if claim_amount is not None and claim_amount > 50000:
            signals.append(
                FraudSignal(
                    code="HIGH_AMOUNT",
                    weight=18,
                    reason="Claim amount is materially high and warrants review.",
                    metadata={"claim_amount": claim_amount},
                )
            )

        if (
            claim_amount is not None
            and approved_amount is not None
            and claim_amount > approved_amount * 1.5
        ):
            signals.append(
                FraudSignal(
                    code="AMOUNT_EXCEEDS_EXPECTED",
                    weight=22,
                    reason="Claim amount significantly exceeds expected approved amount.",
                    metadata={
                        "claim_amount": claim_amount,
                        "approved_amount": approved_amount,
                    },
                )
            )

        if deductible is not None and claim_amount is not None and deductible > claim_amount:
            signals.append(
                FraudSignal(
                    code="DEDUCTIBLE_ANOMALY",
                    weight=12,
                    reason="Deductible exceeds claim amount, which is inconsistent.",
                    metadata={
                        "deductible": deductible,
                        "claim_amount": claim_amount,
                    },
                )
            )

        ocr_confidence = context.ocr_confidence
        if ocr_confidence is not None:
            metadata["ocr_confidence"] = ocr_confidence
            if ocr_confidence < 0.65:
                signals.append(
                    FraudSignal(
                        code="LOW_OCR_CONFIDENCE",
                        weight=14,
                        reason="OCR confidence is low, so source data may be unreliable.",
                        metadata={"ocr_confidence": ocr_confidence},
                    )
                )

        if context.ocr_text and self._looks_like_noisy_ocr(context.ocr_text):
            signals.append(
                FraudSignal(
                    code="NOISY_OCR_TEXT",
                    weight=10,
                    reason="OCR text appears noisy or partially unreadable.",
                )
            )

        policy_hits = 0
        for rule in context.policy_rules:
            status = str(rule.get("status", "")).upper()
            if status in {"VIOLATION", "DENY", "REJECT"}:
                policy_hits += 1
                signals.append(
                    FraudSignal(
                        code="POLICY_VIOLATION",
                        weight=20,
                        reason=str(
                            rule.get("reason") or "Policy rule indicates a violation."
                        ),
                        metadata={"rule": rule},
                    )
                )

        fraud_pattern_hits = 0
        for pattern in context.fraud_patterns:
            matched = pattern.get("matched", True)
            if matched:
                fraud_pattern_hits += 1
                severity = str(pattern.get("severity", "MEDIUM")).upper()
                weight = {"LOW": 8, "MEDIUM": 14, "HIGH": 22}.get(severity, 14)
                signals.append(
                    FraudSignal(
                        code=str(pattern.get("code") or "FRAUD_PATTERN"),
                        weight=weight,
                        reason=str(
                            pattern.get("reason") or "Known fraud pattern matched."
                        ),
                        metadata={"pattern": pattern},
                    )
                )

        # Detect frequent claims (basic fraud pattern)
        previous_claims = context.claim_data.get("previous_claims", [])

        if isinstance(previous_claims, list) and len(previous_claims) >= 3:
            signals.append(
                FraudSignal(
                    code="FREQUENT_CLAIMS",
                    weight=18,
                    reason="Multiple claims submitted in short period (suspicious).",
                    metadata={"count": len(previous_claims)},
                )
            )

        # Abhi synthetic data me manually pass kar sakte ho

        metadata["policy_hits"] = policy_hits
        metadata["fraud_pattern_hits"] = fraud_pattern_hits

        raw_score = sum(signal.weight for signal in signals)

        #risk_score = max(0, min(100, int(round(raw_score)))) old one

        # Non-linear scaling (zyada realistic lagta hai)
        risk_score = int(100 * (1 - (1 / (1 + raw_score / 50))))
        risk_score = max(0, min(100, risk_score))
        # Agar simple rakhna ho to old linear scoring bhi use kar sakte ho

        reasons = [signal.reason for signal in signals]

        if not reasons:
            reasons.append("No rule-based fraud indicators were triggered.")

        return RuleScoreResult(
            risk_score=risk_score,
            reasons=reasons,
            signals=signals,
            metadata=metadata,
        )

    def _compose_decision(
        self,
        context: ClaimContext,
        rule_result: RuleScoreResult,
        llm_payload: Optional[LLMDecisionPayload],
    ) -> DecisionResponse:
        if llm_payload is None:
            llm_decision = FraudDecision.FLAG if rule_result.risk_score >= 35 else FraudDecision.APPROVE
            llm_confidence = 0.55 if rule_result.risk_score >= 35 else 0.7
            llm_reasons = ["LLM unavailable; used deterministic rule-based fallback."]
        else:
            llm_decision = llm_payload.decision
            llm_confidence = llm_payload.confidence
            llm_reasons = llm_payload.reasons

        cleanliness_score = 1 - (rule_result.risk_score / 100)
        effective_confidence = round(
            min(1.0, max(0.0, (cleanliness_score * 0.45) + (llm_confidence * 0.55))),
            4,
        )

        decision = self._finalize_decision(
            rule_risk_score=rule_result.risk_score,
            llm_decision=llm_decision,
            llm_confidence=llm_confidence,
            has_low_quality_input=self._has_low_quality_input(context),
        )

        reasons = self._deduplicate_reasons(rule_result.reasons + llm_reasons)

        return DecisionResponse(
            decision=decision,
            confidence=effective_confidence,
            risk_score=rule_result.risk_score,
            reasons=reasons[:10],
            signals=rule_result.signals,
            metadata={
                **rule_result.metadata,
                "llm_used": llm_payload is not None,
                "llm_decision": llm_decision.value,
                "llm_confidence": llm_confidence,
            },
        )

    def _finalize_decision(
        self,
        rule_risk_score: int,
        llm_decision: FraudDecision,
        llm_confidence: float,
        has_low_quality_input: bool,
    ) -> FraudDecision:
        if has_low_quality_input or llm_confidence < self._uncertainty_confidence_threshold:
            return FraudDecision.FLAG
        if rule_risk_score >= 85:
            return FraudDecision.REJECT
        if rule_risk_score >= 45:
            return FraudDecision.FLAG
        if llm_decision == FraudDecision.REJECT and rule_risk_score >= 70:
            return FraudDecision.REJECT
        if llm_decision == FraudDecision.APPROVE and rule_risk_score < 35:
            return FraudDecision.APPROVE
        return FraudDecision.FLAG if rule_risk_score >= 35 else FraudDecision.APPROVE

    def _has_low_quality_input(self, context: ClaimContext) -> bool:
        required_fields = ("claim_id", "patient_id", "claim_amount")
        missing_required = any(not context.claim_data.get(field) for field in required_fields)
        low_ocr_confidence = context.ocr_confidence is not None and context.ocr_confidence < 0.65
        noisy_ocr = bool(context.ocr_text and self._looks_like_noisy_ocr(context.ocr_text))
        return missing_required or low_ocr_confidence or noisy_ocr

    def _append_if_missing(
        self,
        payload: Dict[str, Any],
        key: str,
        weight: float,
        reason: str,
        signals: List[FraudSignal],
    ) -> None:
        if payload.get(key) in (None, "", [], {}):
            signals.append(FraudSignal(code=f"MISSING_{key.upper()}", weight=weight, reason=reason))

    def _looks_like_noisy_ocr(self, text: str) -> bool:
        stripped = re.sub(r"\s+", "", text)
        if not stripped:
            return True
        symbol_count = sum(1 for char in stripped if not char.isalnum())
        symbol_ratio = symbol_count / len(stripped)
        return symbol_ratio > 0.35 or "??" in text or "�" in text

    def _coerce_float(self, value: Any) -> Optional[float]:
        if value in (None, "", [], {}):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        cleaned = re.sub(r"[^0-9.\-]", "", str(value))
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None

    def _deduplicate_reasons(self, reasons: List[str]) -> List[str]:
        seen = set()
        deduped: List[str] = []
        for reason in reasons:
            normalized = reason.strip()
            if normalized and normalized not in seen:
                deduped.append(normalized)
                seen.add(normalized)
        return deduped

    def _model_to_dict(self, model: Any) -> Dict[str, Any]:
        if hasattr(model, "model_dump"):
            return model.model_dump()
        return model.dict()

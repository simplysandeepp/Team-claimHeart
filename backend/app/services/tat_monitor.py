"""
TAT Monitor (Turnaround Time Monitor)

Tracks timestamps at each pipeline stage and computes SLA compliance.
Designed to be integrated into the Insurance Dashboard UI.

SLA Thresholds (defined per the roadmap):
  - OCR Extraction:     < 10s
  - Policy Evaluation:  < 2s
  - Fraud Investigation: < 3s
  - Decision Routing:   < 1s
  - Mediator (if fired): < 5s
  - Total Pipeline:     < 30s
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── SLA Thresholds (seconds) ─────────────────────────────────────────
SLA_THRESHOLDS = {
    "ocr_extraction":      10.0,
    "policy_evaluation":    2.0,
    "fraud_investigation":  3.0,
    "decision_routing":     1.0,
    "mediator":             5.0,
    "total_pipeline":      30.0,
}


@dataclass
class StageTimer:
    """Records the start/end time of a single pipeline stage."""
    stage_name: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    def start(self) -> "StageTimer":
        self.start_time = datetime.now(timezone.utc)
        return self

    def stop(self) -> "StageTimer":
        self.end_time = datetime.now(timezone.utc)
        return self

    @property
    def elapsed_seconds(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return round((self.end_time - self.start_time).total_seconds(), 4)
        return None

    @property
    def sla_limit(self) -> Optional[float]:
        return SLA_THRESHOLDS.get(self.stage_name)

    @property
    def sla_status(self) -> str:
        elapsed = self.elapsed_seconds
        limit = self.sla_limit
        if elapsed is None:
            return "PENDING"
        if limit is None:
            return "NO_SLA"
        return "OK" if elapsed <= limit else "BREACHED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stage": self.stage_name,
            "elapsed_s": self.elapsed_seconds,
            "sla_limit_s": self.sla_limit,
            "sla_status": self.sla_status,
            "start": self.start_time.isoformat() if self.start_time else None,
            "end": self.end_time.isoformat() if self.end_time else None,
        }


@dataclass
class TATReport:
    """
    Full TAT report for a single claim's pipeline run.
    Ready to be served to the Insurance Dashboard UI.
    """
    claim_id: str
    stages: List[StageTimer] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def total_elapsed(self) -> Optional[float]:
        """Sum of all completed stage durations."""
        times = [s.elapsed_seconds for s in self.stages if s.elapsed_seconds is not None]
        return round(sum(times), 4) if times else None

    @property
    def total_sla_status(self) -> str:
        limit = SLA_THRESHOLDS.get("total_pipeline")
        total = self.total_elapsed
        if total is None or limit is None:
            return "PENDING"
        return "OK" if total <= limit else "BREACHED"

    @property
    def breached_stages(self) -> List[str]:
        return [s.stage_name for s in self.stages if s.sla_status == "BREACHED"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "created_at": self.created_at,
            "stages": [s.to_dict() for s in self.stages],
            "total_elapsed_s": self.total_elapsed,
            "total_sla_limit_s": SLA_THRESHOLDS["total_pipeline"],
            "total_sla_status": self.total_sla_status,
            "breached_stages": self.breached_stages,
            "dashboard_summary": {
                "status": "BREACH" if self.breached_stages else "ON_TIME",
                "total_s": self.total_elapsed,
                "stages_count": len(self.stages),
                "breaches": len(self.breached_stages),
            }
        }


class TATMonitor:
    """
    Context-manager style TAT tracker for the pipeline orchestrator.

    Usage:
        monitor = TATMonitor("Id-claim123")
        with monitor.track("ocr_extraction"):
            # ... run OCR ...
        with monitor.track("fraud_investigation"):
            # ... run fraud ...
        report = monitor.finalize()
    """

    def __init__(self, claim_id: str):
        self.claim_id = claim_id
        self._report = TATReport(claim_id=claim_id)
        self._current_stage: Optional[StageTimer] = None
        self._persist_path = Path(__file__).resolve().parent.parent / "data" / "tat_logs.jsonl"

    def track(self, stage_name: str) -> "_StageContext":
        """Returns a context manager for a named pipeline stage."""
        timer = StageTimer(stage_name=stage_name)
        self._report.stages.append(timer)
        return _StageContext(timer)

    def finalize(self) -> TATReport:
        """Finalize the report and persist it for dashboard consumption."""
        self._persist(self._report)
        logger.info(
            f"[TAT] Claim {self.claim_id}: "
            f"total={self._report.total_elapsed}s, "
            f"status={self._report.total_sla_status}, "
            f"breaches={self._report.breached_stages}"
        )
        return self._report

    def _persist(self, report: TATReport):
        try:
            with self._persist_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(report.to_dict()) + "\n")
        except Exception as e:
            logger.error(f"[TAT] Failed to persist TAT log: {e}")


class _StageContext:
    """Internal context manager returned by TATMonitor.track()."""
    def __init__(self, timer: StageTimer):
        self._timer = timer

    def __enter__(self) -> "_StageContext":
        self._timer.start()
        return self

    def __exit__(self, *_) -> None:
        self._timer.stop()

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict


class PlatformStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def load(self) -> Dict[str, Any]:
        with self._lock:
            if not self.path.exists():
                state = self._default_state()
                self._write_unlocked(state)
                return state

            raw = self.path.read_text(encoding="utf-8").strip()
            if not raw:
                state = self._default_state()
                self._write_unlocked(state)
                return state

            state = json.loads(raw)
            for key, default in self._default_state().items():
                state.setdefault(key, default)
            return state

    def save(self, state: Dict[str, Any]) -> None:
        with self._lock:
            self._write_unlocked(state)

    def _write_unlocked(self, state: Dict[str, Any]) -> None:
        self.path.write_text(json.dumps(state, indent=2), encoding="utf-8")

    @staticmethod
    def _default_state() -> Dict[str, Any]:
        return {
            "users": [],
            "claims": [],
            "notifications": [],
        }

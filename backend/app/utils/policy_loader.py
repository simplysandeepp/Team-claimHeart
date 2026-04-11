import json
import logging
from pathlib import Path
from functools import lru_cache
from typing import Dict, Any

logger = logging.getLogger(__name__)

class PolicyValidationError(Exception):
    """Exception raised for structurally invalid policy data."""
    pass

@lru_cache(maxsize=1)
def get_policy_data() -> Dict[str, Any]:
    """
    Loads and caches the canonical mock_policies.json data.
    Validates the structure before returning.
    """
    policy_path = Path(__file__).resolve().parent.parent / "data" / "mock_policies.json"
    
    if not policy_path.exists():
        raise FileNotFoundError(f"Policy file not found at {policy_path}")
        
    logger.info(f"Loading policy from disk: {policy_path}")
    
    with policy_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
        
    _validate_policy_structure(data)
    return data

def _validate_policy_structure(data: Dict[str, Any]):
    """
    Validates that each top-level claim policy has the core foundation blocks.
    """
    if not data:
        raise PolicyValidationError("Policy JSON is empty.")
        
    for policy_name, policy_content in data.items():
        if not isinstance(policy_content, dict):
            raise PolicyValidationError(f"Policy '{policy_name}' MUST be a dictionary.")
            
        required_keys = ["policy_metadata", "global_conditions", "disease_sub_limits"]
        missing_keys = [k for k in required_keys if k not in policy_content]
        
        if missing_keys:
            raise PolicyValidationError(
                f"Policy '{policy_name}' is missing required structural blocks: {missing_keys}"
            )
            
    logger.debug(f"Policy data successfully validated (Keys verified: {list(data.keys())})")

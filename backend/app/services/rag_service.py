import json
from pathlib import Path

def load_policy():
    policy_path = Path(__file__).resolve().parent.parent / "data" / "policy_rules.json"
    with policy_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_claim(claim):
    issues = []

    if not claim.get("disease"):
        issues.append("Missing diagnosis")

    if not claim.get("amount"):
        issues.append("Missing billing amount")

    return issues


def analyze_claim(claim):
    policy = load_policy()

    result = {
        "decision": "APPROVE",
        "flags": [],
        "reason": [],
        "validation_issues": []
    }

    #validating the claim for missing or incomplete information before applying policy rules
    issues = validate_claim(claim)
    if issues:
        result["decision"] = "INCOMPLETE"
        result["validation_issues"] = issues
        return result

    disease = claim.get("disease")
    meds = claim.get("medications", [])

    # policy check ..
    if disease not in policy:
        result["decision"] = "FLAG"
        result["flags"].append("unknown_disease")
        result["reason"].append("Disease not covered in policy")
        return result

    disease_policy = policy[disease]

    # Coverage check
    if not disease_policy.get("covered", False):
        result["decision"] = "REJECT"
        result["flags"].append("not_covered")
        result["reason"].append(f"{disease} is not covered")
        return result

    # Medication check
    allowed = disease_policy.get("allowed_medications", [])

    for med in meds:
        if med not in allowed:
            result["flags"].append("med_not_allowed")
            result["reason"].append(f"{med} not allowed")

    return result

from app.utils.policy_loader import get_policy_data

def validate_claim(claim):
    issues = []
    if not claim.get("disease"):
        issues.append("Missing diagnosis")
    if not claim.get("amount"):
        issues.append("Missing billing amount")
    return issues


def analyze_claim(claim):
    policy_data = get_policy_data()
    master_policy = policy_data.get("CARE-COMPREHENSIVE-MASTER-2026", {})
    sub_limits = master_policy.get("disease_sub_limits", {})
    
    result = {
        "decision": "APPROVE",
        "flags": [],
        "reason": [],
        "validation_issues": []
    }
    
    issues = validate_claim(claim)
    if issues:
        result["decision"] = "INCOMPLETE"
        result["validation_issues"] = issues
        return result

    disease = claim.get("disease")
    amount = claim.get("amount", 0) or 0
    hospital_days = claim.get("hospital_stay_days", 0) or 0
    meds_count = claim.get("medications_count", 0) or 0
    tests_count = claim.get("diagnostic_tests_count", 0) or 0
    
    # 0. Coverage Check
    if disease not in sub_limits:
        result["decision"] = "FLAG"
        result["flags"].append("unknown_disease")
        result["reason"].append(f"Disease '{disease}' not explicitly mapped in sub-limits. Requires manual review.")
        return result
        
    disease_policy = sub_limits[disease]
    
    # 1. Amount Sub-limit Check
    if amount > disease_policy.get("max_payable_inr", float('inf')):
        result["decision"] = "FLAG"
        result["flags"].append("amount_exceeds_sublimit")
        result["reason"].append(f"Billed amount {amount} exceeds disease sub-limit {disease_policy['max_payable_inr']}.")

    # 2. Hospitalization Days Check
    if hospital_days > disease_policy.get("max_hospitalization_days_allowed", float('inf')):
        result["decision"] = "FLAG"
        result["flags"].append("hospital_days_exceeded")
        result["reason"].append(f"Hospital stay ({hospital_days} days) exceeds allowed {disease_policy['max_hospitalization_days_allowed']} days.")

    # 3. Protocol Checks
    if meds_count > disease_policy.get("max_pharmacy_dosages_per_day", float('inf')):
        result["decision"] = "FLAG"
        result["flags"].append("protocol_violation_meds")
        result["reason"].append(f"Medication count ({meds_count}) exceeds protocol max {disease_policy['max_pharmacy_dosages_per_day']}.")
        
    if tests_count > disease_policy.get("max_diagnostic_tests_per_day", float('inf')):
        result["decision"] = "FLAG"
        result["flags"].append("protocol_violation_tests")
        result["reason"].append(f"Diagnostic tests ({tests_count}) exceeds protocol max {disease_policy['max_diagnostic_tests_per_day']}.")

    # 4. Tenancy / Waiting Period Check
    if disease_policy.get("specific_waiting_period_days", 0) > 0:
        result["decision"] = "FLAG"
        result["flags"].append("waiting_period_verification_required")
        result["reason"].append(f"Disease has a {disease_policy['specific_waiting_period_days']} day waiting period. Tenant duration must be verified.")

    # 5. Field Verification threshold
    if amount > disease_policy.get("requires_field_verification_above_inr", float('inf')):
        result["decision"] = "FLAG"
        result["flags"].append("field_verification_required")
        result["reason"].append(f"High value claim (INR {amount}). Physical verification triggered.")

    if not result["flags"]:
        result["decision"] = "APPROVE"
        result["reason"].append(f"Claim successfully validated against '{disease}' protocols.")
        
    return result

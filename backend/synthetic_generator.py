import random
import uuid
import json
import os
from datetime import datetime, timedelta


# hospitals list
hospitals = [
    "CityCare Hospital", "Apollo Clinic", "MedLife Center",
    "Sunrise Hospital", "Fortis Healthcare"
]


# (treatment, min_cost, max_cost)
treatments = [
    ("Appendectomy", 15000, 30000),
    ("Fracture Treatment", 5000, 20000),
    ("Dental Surgery", 3000, 15000),
    ("General Checkup", 500, 3000),
    ("Heart Surgery", 80000, 200000)
]


# OCR noise 
def add_ocr_noise(text):
    replacements = {
        "0": "O",
        "5": "S",
        "2": "Z"
    }

    noisy = ""
    for ch in text:
        if ch in replacements and random.random() < 0.15:
            noisy += replacements[ch]
        else:
            noisy += ch

    return noisy


# Random date generator
def random_date():
    start = datetime(2025, 1, 1)
    end = datetime(2026, 3, 1)
    delta = end - start

    return (start + timedelta(days=random.randint(0, delta.days))).strftime("%Y-%m-%d")


# Main claim generator
def generate_claim():
    treatment, min_cost, max_cost = random.choice(treatments)

    amount = random.randint(min_cost, max_cost)
    hospital = random.choice(hospitals)
    date = random_date() 

    claim_type = random.choices(
        ["normal", "suspicious", "fraud"],
        weights=[0.6, 0.3, 0.1]
    )[0]

    anomaly_flags = []
    ground_truth = "APPROVE"

    # Suspicious case
    if claim_type == "suspicious":
        anomaly_flags.append("amount_high")
        amount *= random.randint(2, 3)
        ground_truth = "FLAG"

    # Fraud case
    elif claim_type == "fraud":
        anomaly_flags.extend(["duplicate_possible", "fake_bill"])
        amount *= random.randint(3, 5)
        ground_truth = "REJECT"

    # Bill text (single line → less buggy)
    bill_text = f"Hospital: {hospital} | Treatment: {treatment} | Amount: {amount} INR | Date: {date}"

    bill_text = add_ocr_noise(bill_text)

    return {
        "claim_id": str(uuid.uuid4())[:8],
        "structured_data": {
            "amount": amount,
            "date": date,
            "hospital": hospital,
            "treatment": treatment
        },
        "bill_text": bill_text,
        "anomaly_flags": anomaly_flags,
        "ground_truth": ground_truth
    }


# Dataset generator
def generate_dataset(n=50):
    return [generate_claim() for _ in range(n)]


# MAIN RUN
if __name__ == "__main__":
    data = generate_dataset(20)

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(BASE_DIR, "synthetic_claims.json")

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Dataset generated at: {file_path}")
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.extraction.table_parser import parse_tables
from app.utils.parser import parse_medical_text


def test_parse_medical_text_extracts_claim_summary_fields():
    sample = """
    Patient Name: Arjun Mehta
    Diagnosis: Dengue fever
    Bed rest for 5 days
    Tab Paracetamol 500mg 1-0-1
    Injection Ceftriaxone 1g BD
    Elastic bandage applied
    Injection charge 1 500 500
    """

    result = parse_medical_text(sample)

    assert result["claim_summary"]["disease"] == "Dengue fever"
    assert result["claim_summary"]["hospital_stay_days"] == 5
    assert result["claim_summary"]["medications"] == [
        {"name": "Paracetamol", "dosage": "500mg", "frequency": "1-0-1"},
        {"name": "Ceftriaxone", "dosage": "1g", "frequency": "BD"},
    ]
    assert result["claim_summary"]["treatments"] == ["injection", "bandage"]
    assert result["billing_items"][0]["item"] == "Injection charge"
    assert result["billing_items"][0]["quantity"] == 1
    assert result["billing_items"][0]["price"] == 500
    assert result["billing_items"][0]["total"] == 500


def test_parse_tables_maps_billing_columns():
    tables = [
        {
            "table_id": 1,
            "rows": [
                ["Item", "Qty", "Price", "Total"],
                ["Bandage", "2", "150", "300"],
                ["Procedure charge", "1", "500", "500"],
            ],
        }
    ]

    result = parse_tables(tables)

    assert result["billing_items"] == [
        {
            "item": "Bandage",
            "quantity": 2,
            "price": 150.0,
            "total": 300.0,
            "source": "table",
        },
        {
            "item": "Procedure charge",
            "quantity": 1,
            "price": 500.0,
            "total": 500.0,
            "source": "table",
        },
    ]

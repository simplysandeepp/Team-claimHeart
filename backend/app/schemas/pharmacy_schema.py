PHARMACY_PROMPT = """
- pharmacy_details: {name, gst_number, bill_number}
- items: List of {medicine_name, batch_number, expiry_date, qty, unit_price, tax_amount}
- prescribing_doctor: {name, department}
"""
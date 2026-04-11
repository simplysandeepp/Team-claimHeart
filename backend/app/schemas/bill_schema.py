BILL_PROMPT = """
Extract the following information from this medical bill text into a JSON format:
- hospital_details: {name, address, registration_no}
- patient_details: {name, age, gender, id}
- billing_items: List of {description, quantity, unit_price, total_tax, total_amount}
- totals: {subtotal, tax, discount, grand_total}
- dates: {bill_date, admission_date, discharge_date}
"""
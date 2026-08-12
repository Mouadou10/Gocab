import http.client
import json
import time

conn = http.client.HTTPConnection("localhost", 3000)
conn.request("GET", "/api/leads")
res = conn.getresponse()
data = json.loads(res.read().decode())
leads = data.get("leads", [])

if not leads:
    print("No leads found")
else:
    lead = leads[0]
    lead_id = lead["id"]
    print(f"Testing lead {lead_id}")
    
    payload = {
        "board_column": "BRAND_PRE_FILTER",
        "brand_status": "Not interested"
    }
    
    conn.request("PATCH", f"/api/leads/{lead_id}", json.dumps(payload), {"Content-Type": "application/json"})
    patch_res = conn.getresponse()
    patch_data = patch_res.read().decode()
    print(f"PATCH status: {patch_res.status}")
    print(f"PATCH response: {patch_data}")

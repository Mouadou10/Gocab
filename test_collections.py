import http.client
import json

conn = http.client.HTTPConnection("localhost", 3000)

payload = {
    "date": "2026-08-06",
    "collector_name": "Aziz",
    "expected_total": 12500,
    "notes": "Test target"
}

conn.request("POST", "/api/collections", json.dumps(payload), {"Content-Type": "application/json"})
res = conn.getresponse()
data = res.read().decode()

print(f"Status: {res.status}")
print(f"Response: {data}")

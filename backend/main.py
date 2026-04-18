"""
CertisHack FastAPI Backend
Run with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone
import uuid
import hashlib

app = FastAPI(title="CertisHack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

USERS = {}
INCIDENTS = {}
OFFICERS = {}
RECOMMENDATIONS = {}
TOKENS = {}

def seed():
    now = datetime.now(timezone.utc).isoformat()
    USERS["admin"] = {
        "id": "admin",
        "email": "admin@certis.local",
        "name": "Admin Officer",
        "role": "admin",
        "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
    }
    for o in [
        {"name": "James Tan",  "badge_id": "C001", "status": "available",  "current_zone": "Terminal A",   "latitude": 1.3521, "longitude": 103.9880, "specialization": "general"},
        {"name": "Sarah Lim",  "badge_id": "C002", "status": "on_patrol",  "current_zone": "Terminal B",   "latitude": 1.3530, "longitude": 103.9895, "specialization": "tactical"},
        {"name": "David Ng",   "badge_id": "C003", "status": "available",  "current_zone": "Cargo Zone",   "latitude": 1.3510, "longitude": 103.9860, "specialization": "k9"},
        {"name": "Priya Raj",  "badge_id": "C004", "status": "responding", "current_zone": "Gate 22",      "latitude": 1.3545, "longitude": 103.9910, "specialization": "medical"},
    ]:
        oid = str(uuid.uuid4())
        OFFICERS[oid] = {"id": oid, "created_date": now, **o}
    for inc in [
        {
            "title": "Unattended Bag — Gate 12",
            "description": "Passenger reported an unattended black duffel bag near Gate 12 seating area.",
            "type": "unattended_bag", "severity": 7, "status": "active",
            "location_name": "Terminal B Gate 12", "latitude": 1.3535, "longitude": 103.9898,
            "assigned_officer": "Sarah Lim",
            "narrative": "At 14:32 a passenger alerted staff to an unattended black bag. Area partially cordoned. K9 unit en route.",
            "timestamp": now, "alerts": [], "officer_feedback": [], "post_analysis": None,
        },
        {
            "title": "Medical Emergency — Arrival Hall",
            "description": "Elderly passenger collapsed near baggage carousel 3.",
            "type": "medical", "severity": 8, "status": "responding",
            "location_name": "Arrival Hall Level 1", "latitude": 1.3518, "longitude": 103.9875,
            "assigned_officer": "Priya Raj",
            "narrative": "Passenger collapsed at 14:45. AED deployed. Medical team notified.",
            "timestamp": now, "alerts": [], "officer_feedback": [], "post_analysis": None,
        },
        {
            "title": "Perimeter Breach — Cargo Zone",
            "description": "Motion sensor triggered on the southern cargo fence line.",
            "type": "intrusion", "severity": 9, "status": "resolved",
            "location_name": "Cargo Zone South Fence", "latitude": 1.3508, "longitude": 103.9855,
            "assigned_officer": "David Ng",
            "narrative": "Sensor triggered at 13:10. Officers investigated — found damaged fence panel from maintenance. No intrusion confirmed.",
            "timestamp": now, "alerts": [], "officer_feedback": [], "post_analysis": None,
        },
    ]:
        iid = str(uuid.uuid4())
        INCIDENTS[iid] = {"id": iid, "created_date": now, **inc}

seed()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = TOKENS.get(credentials.credentials)
    if not user_id or user_id not in USERS:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return USERS[user_id]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# Auth
@app.post("/auth/login")
def login(req: dict):
    user = next((u for u in USERS.values() if u["email"] == req.get("email", "")), None)
    if not user or user["password_hash"] != hashlib.sha256(req.get("password", "").encode()).hexdigest():
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = str(uuid.uuid4())
    TOKENS[token] = user["id"]
    return {"access_token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}

@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}

# Incidents
@app.get("/incidents")
def list_incidents(sort: Optional[str] = None, limit: Optional[int] = None, _=Depends(get_current_user)):
    items = list(INCIDENTS.values())
    if sort:
        items = sorted(items, key=lambda x: x.get(sort.lstrip("-")) or "", reverse=sort.startswith("-"))
    return items[:limit] if limit else items

@app.get("/incidents/{item_id}")
def get_incident(item_id: str, _=Depends(get_current_user)):
    item = INCIDENTS.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item

@app.post("/incidents", status_code=201)
def create_incident(data: dict, _=Depends(get_current_user)):
    iid = str(uuid.uuid4())
    item = {"id": iid, "created_date": now_iso(), **data}
    INCIDENTS[iid] = item
    return item

@app.patch("/incidents/{item_id}")
def update_incident(item_id: str, data: dict, _=Depends(get_current_user)):
    if item_id not in INCIDENTS:
        raise HTTPException(status_code=404, detail="Not found")
    INCIDENTS[item_id].update({k: v for k, v in data.items() if v is not None})
    return INCIDENTS[item_id]

@app.delete("/incidents/{item_id}", status_code=204)
def delete_incident(item_id: str, _=Depends(get_current_user)):
    if item_id not in INCIDENTS:
        raise HTTPException(status_code=404, detail="Not found")
    del INCIDENTS[item_id]

# Officers
@app.get("/officers")
def list_officers(sort: Optional[str] = None, limit: Optional[int] = None, _=Depends(get_current_user)):
    items = list(OFFICERS.values())
    if sort:
        items = sorted(items, key=lambda x: x.get(sort.lstrip("-")) or "", reverse=sort.startswith("-"))
    return items[:limit] if limit else items

@app.get("/officers/{item_id}")
def get_officer(item_id: str, _=Depends(get_current_user)):
    item = OFFICERS.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item

@app.post("/officers", status_code=201)
def create_officer(data: dict, _=Depends(get_current_user)):
    iid = str(uuid.uuid4())
    item = {"id": iid, "created_date": now_iso(), **data}
    OFFICERS[iid] = item
    return item

@app.patch("/officers/{item_id}")
def update_officer(item_id: str, data: dict, _=Depends(get_current_user)):
    if item_id not in OFFICERS:
        raise HTTPException(status_code=404, detail="Not found")
    OFFICERS[item_id].update({k: v for k, v in data.items() if v is not None})
    return OFFICERS[item_id]

@app.delete("/officers/{item_id}", status_code=204)
def delete_officer(item_id: str, _=Depends(get_current_user)):
    if item_id not in OFFICERS:
        raise HTTPException(status_code=404, detail="Not found")
    del OFFICERS[item_id]

# Recommendations
@app.get("/recommendations")
def list_recommendations(sort: Optional[str] = None, limit: Optional[int] = None, _=Depends(get_current_user)):
    items = list(RECOMMENDATIONS.values())
    if sort:
        items = sorted(items, key=lambda x: x.get(sort.lstrip("-")) or "", reverse=sort.startswith("-"))
    return items[:limit] if limit else items

@app.get("/recommendations/{item_id}")
def get_recommendation(item_id: str, _=Depends(get_current_user)):
    item = RECOMMENDATIONS.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return item

@app.post("/recommendations", status_code=201)
def create_recommendation(data: dict, _=Depends(get_current_user)):
    iid = str(uuid.uuid4())
    item = {"id": iid, "created_date": now_iso(), **data}
    RECOMMENDATIONS[iid] = item
    return item

@app.patch("/recommendations/{item_id}")
def update_recommendation(item_id: str, data: dict, _=Depends(get_current_user)):
    if item_id not in RECOMMENDATIONS:
        raise HTTPException(status_code=404, detail="Not found")
    RECOMMENDATIONS[item_id].update({k: v for k, v in data.items() if v is not None})
    return RECOMMENDATIONS[item_id]

@app.delete("/recommendations/{item_id}", status_code=204)
def delete_recommendation(item_id: str, _=Depends(get_current_user)):
    if item_id not in RECOMMENDATIONS:
        raise HTTPException(status_code=404, detail="Not found")
    del RECOMMENDATIONS[item_id]

@app.get("/health")
def health():
    return {"status": "ok"}

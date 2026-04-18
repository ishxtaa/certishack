from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from math import radians, sin, cos, sqrt, asin

app = FastAPI(title="Certis Security Advisor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_TOKEN = "demo-token"

demo_user = {
    "id": 1,
    "full_name": "Officer Rachel Tan",
    "email": "admin@certis.local",
    "role": "admin",
    "badge_id": "SG-1001"
}

officers = [
    {
        "id": 1,
        "name": "Officer Rachel Tan",
        "badge_id": "SG-1001",
        "status": "available",
        "specialization": "general",
        "current_zone": "Terminal 2 - Departure",
        "latitude": 1.3530,
        "longitude": 103.9893
    },
    {
        "id": 2,
        "name": "Officer Vikram Shah",
        "badge_id": "SG-1022",
        "status": "responding",
        "specialization": "medical",
        "current_zone": "Jewel",
        "latitude": 1.3604,
        "longitude": 103.9893
    },
    {
        "id": 3,
        "name": "Officer Aisha Lim",
        "badge_id": "SG-1048",
        "status": "on_patrol",
        "specialization": "tactical",
        "current_zone": "Terminal 1 - Departure",
        "latitude": 1.3621,
        "longitude": 103.9882
    },
    {
        "id": 4,
        "name": "Officer Daniel Lee",
        "badge_id": "SG-1091",
        "status": "off_duty",
        "specialization": "fire",
        "current_zone": "Cargo Complex",
        "latitude": 1.3500,
        "longitude": 103.9750
    }
]

incidents = [
    {
        "id": 1,
        "title": "Panic audio near lift lobby",
        "type": "panic",
        "incident_type": "panic_audio",
        "severity": 9.2,
        "priority": "critical",
        "status": "active",
        "location_name": "Terminal 2 Lift Lobby",
        "location": "Terminal 2 Lift Lobby",
        "latitude": 1.3535,
        "longitude": 103.9888,
        "timestamp": "2026-04-12T20:15:00Z",
        "created_date": "2026-04-12T20:15:00Z",
        "description": "Distress audio detected from intercom with crowd clustering nearby.",
        "timeline_explanation": "Panic audio was detected at the Terminal 2 lift lobby, with CCTV indicating crowd buildup around the area.",
        "narrative": None,
        "assigned_officer": None,
        "alerts": [
            {"source": "audio", "message": "Distress call detected from lift intercom"},
            {"source": "cctv", "message": "Crowd gathering near lift lobby"},
            {"source": "sensor", "message": "Motion spike detected in adjacent corridor"}
        ],
        "officer_feedback": [],
        "post_analysis": None
    },
    {
        "id": 2,
        "title": "Unauthorized access at restricted gate",
        "type": "access_violation",
        "incident_type": "door_alarm",
        "severity": 7.6,
        "priority": "high",
        "status": "responding",
        "location_name": "Restricted Gate B3",
        "location": "Restricted Gate B3",
        "latitude": 1.3580,
        "longitude": 103.9810,
        "timestamp": "2026-04-12T19:52:00Z",
        "created_date": "2026-04-12T19:52:00Z",
        "description": "Door alarm and access control mismatch detected at restricted gate.",
        "timeline_explanation": "Access logs and door alarm suggest a likely unauthorized entry attempt at a restricted gate.",
        "narrative": None,
        "assigned_officer": "Officer Aisha Lim",
        "alerts": [
            {"source": "access", "message": "Access badge denied twice at gate"},
            {"source": "door", "message": "Door forced open alarm triggered"}
        ],
        "officer_feedback": [],
        "post_analysis": None
    },
    {
        "id": 3,
        "title": "Unattended bag in arrival hall",
        "type": "unattended_bag",
        "incident_type": "cctv_object",
        "severity": 6.8,
        "priority": "high",
        "status": "contained",
        "location_name": "Terminal 1 - Arrival",
        "location": "Terminal 1 - Arrival",
        "latitude": 1.3610,
        "longitude": 103.9900,
        "timestamp": "2026-04-12T17:30:00Z",
        "created_date": "2026-04-12T17:30:00Z",
        "description": "Bag left unattended for over 12 minutes near seating area.",
        "timeline_explanation": "CCTV identified a stationary bag with no associated owner movement for an extended period.",
        "narrative": None,
        "assigned_officer": "Officer Rachel Tan",
        "alerts": [
            {"source": "cctv", "message": "Stationary object detected"},
            {"source": "cctv", "message": "No owner tracked nearby for 12 minutes"}
        ],
        "officer_feedback": [],
        "post_analysis": None
    },
    {
        "id": 4,
        "title": "Medical assistance requested",
        "type": "medical",
        "incident_type": "intercom_medical",
        "severity": 8.5,
        "priority": "critical",
        "status": "resolved",
        "location_name": "Jewel",
        "location": "Jewel",
        "latitude": 1.3604,
        "longitude": 103.9893,
        "timestamp": "2026-04-12T15:10:00Z",
        "created_date": "2026-04-12T15:10:00Z",
        "description": "Intercom reported dizziness and possible collapse near concourse seating.",
        "timeline_explanation": "A medical distress call indicated a possible collapse, requiring rapid assistance.",
        "narrative": None,
        "assigned_officer": "Officer Vikram Shah",
        "alerts": [
            {"source": "audio", "message": "Medical distress reported over intercom"},
            {"source": "cctv", "message": "Individual seated on floor, limited movement"}
        ],
        "officer_feedback": [],
        "post_analysis": None
    }
]

recommendations = [
    {
        "id": 1,
        "incident_id": 1,
        "action_text": "Dispatch the nearest available officer immediately and maintain remote CCTV monitoring of the lift lobby.",
        "predicted_outcome": "Fast on-site verification with continuous situation visibility and reduced delay to intervention.",
        "confidence": 91,
        "priority": "critical",
        "feedback": "pending",
        "officer_notes": None,
        "created_date": "2026-04-12T20:16:00Z"
    }
]

HIGH_RISK_CHECKPOINTS = [
    {"name": "Terminal 1 - Departure", "lat": 1.3621, "lng": 103.9882, "severity": 4},
    {"name": "Terminal 2 - Departure", "lat": 1.3530, "lng": 103.9893, "severity": 4},
    {"name": "Jewel", "lat": 1.3604, "lng": 103.9893, "severity": 4},
    {"name": "Cargo Complex", "lat": 1.3500, "lng": 103.9750, "severity": 3},
]

class LoginRequest(BaseModel):
    email: str
    password: str

class IncidentPatch(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    incident_type: Optional[str] = None
    severity: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    location_name: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: Optional[str] = None
    created_date: Optional[str] = None
    description: Optional[str] = None
    timeline_explanation: Optional[str] = None
    narrative: Optional[str] = None
    assigned_officer: Optional[str] = None
    alerts: Optional[List[Dict[str, Any]]] = None
    officer_feedback: Optional[List[Dict[str, Any]]] = None
    post_analysis: Optional[str] = None

class OfficerPatch(BaseModel):
    name: Optional[str] = None
    badge_id: Optional[str] = None
    status: Optional[str] = None
    specialization: Optional[str] = None
    current_zone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class RecommendationCreate(BaseModel):
    incident_id: int
    action_text: str
    predicted_outcome: str
    confidence: int
    priority: str
    feedback: Optional[str] = "pending"
    officer_notes: Optional[str] = None

class RecommendationPatch(BaseModel):
    action_text: Optional[str] = None
    predicted_outcome: Optional[str] = None
    confidence: Optional[int] = None
    priority: Optional[str] = None
    feedback: Optional[str] = None
    officer_notes: Optional[str] = None

class OptimizeRouteRequest(BaseModel):
    officer_id: int

class AutoAssignRequest(BaseModel):
    incident_id: int

def require_auth(authorization: Optional[str]):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if authorization != f"Bearer {DEMO_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid token")
    return demo_user

def find_by_id(items, item_id):
    for item in items:
        if item["id"] == item_id:
            return item
    return None

def haversine_distance(lat1, lon1, lat2, lon2):
    r = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))

def specialization_match(incident_type: str, officer_specialization: str) -> float:
    mapping = {
        "medical": ["medical"],
        "fire_alarm": ["fire"],
        "intrusion": ["tactical", "general"],
        "access_violation": ["tactical", "general"],
        "suspicious_behavior": ["tactical", "general"],
        "panic": ["general", "medical"],
        "unattended_bag": ["general", "tactical"],
    }
    preferred = mapping.get(incident_type, ["general"])
    if preferred[0] == officer_specialization:
        return 1.0
    if officer_specialization in preferred:
        return 0.8
    if officer_specialization == "general":
        return 0.65
    return 0.4

def distance_score(km: float) -> float:
    if km <= 0.3:
        return 1.0
    if km <= 0.8:
        return 0.85
    if km <= 1.5:
        return 0.7
    if km <= 3:
        return 0.5
    return 0.25

def workload_score(status: str) -> float:
    if status == "available":
        return 1.0
    if status == "on_patrol":
        return 0.6
    if status == "responding":
        return 0.2
    return 0.0

def rank_officers_for_incident(incident: dict):
    ranked = []
    for officer in officers:
        if officer["status"] not in ["available", "on_patrol"]:
            continue
        km = haversine_distance(
            officer.get("latitude", 1.3604),
            officer.get("longitude", 103.9893),
            incident.get("latitude", 1.3604),
            incident.get("longitude", 103.9893),
        )
        total = (
            distance_score(km) * 0.55
            + specialization_match(incident["type"], officer["specialization"]) * 0.30
            + workload_score(officer["status"]) * 0.15
        )
        ranked.append({
            **officer,
            "distance_km": round(km, 3),
            "score": round(total, 3),
        })
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked

def build_patrol_route(officer: dict):
    active = [
        i for i in incidents
        if i["status"] in ["active", "responding"] and i.get("latitude") and i.get("longitude")
    ]

    enriched = []
    for inc in active:
        km = haversine_distance(
            officer.get("latitude", 1.3604),
            officer.get("longitude", 103.9893),
            inc["latitude"],
            inc["longitude"]
        )
        enriched.append({**inc, "distance_km": km})

    enriched.sort(
        key=lambda x: (
            -(x.get("severity", 0)),
            x["distance_km"]
        )
    )

    stops = [{
        "lat": inc["latitude"],
        "lng": inc["longitude"],
        "name": inc["location_name"],
        "severity": inc["severity"],
        "priority_note": "Critical incident prioritized first." if inc["severity"] >= 8 else f"Prioritized by severity, then distance ({inc['distance_km']:.2f} km)."
    } for inc in enriched]

    existing = {s["name"] for s in stops}
    extras = [c for c in HIGH_RISK_CHECKPOINTS if c["name"] not in existing][:2]
    for c in extras:
        stops.append({
            "lat": c["lat"],
            "lng": c["lng"],
            "name": c["name"],
            "severity": c["severity"],
            "priority_note": "Added as preventive high-risk checkpoint after active incidents."
        })

    return stops

@app.post("/auth/login")
def login(payload: LoginRequest):
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    return {"access_token": DEMO_TOKEN, "user": demo_user}

@app.get("/auth/me")
def me(authorization: Optional[str] = Header(None)):
    require_auth(authorization)
    return demo_user

@app.get("/incidents")
def list_incidents(sort: Optional[str] = None, limit: Optional[int] = None):
    data = incidents[:]
    if sort == "-created_date":
        data.sort(key=lambda x: x.get("created_date", ""), reverse=True)
    elif sort == "created_date":
        data.sort(key=lambda x: x.get("created_date", ""))
    if limit:
        data = data[:limit]
    return data

@app.get("/incidents/{incident_id}")
def get_incident(incident_id: int):
    incident = find_by_id(incidents, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.patch("/incidents/{incident_id}")
def update_incident(incident_id: int, payload: IncidentPatch):
    incident = find_by_id(incidents, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.update(payload.model_dump(exclude_unset=True))
    return incident

@app.get("/officers")
def list_officers(sort: Optional[str] = None, limit: Optional[int] = None):
    data = officers[:]
    if limit:
        data = data[:limit]
    return data

@app.get("/officers/{officer_id}")
def get_officer(officer_id: int):
    officer = find_by_id(officers, officer_id)
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    return officer

@app.patch("/officers/{officer_id}")
def update_officer(officer_id: int, payload: OfficerPatch):
    officer = find_by_id(officers, officer_id)
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    officer.update(payload.model_dump(exclude_unset=True))
    return officer

@app.get("/recommendations")
def list_recommendations(sort: Optional[str] = None, limit: Optional[int] = None):
    data = recommendations[:]
    if sort == "-created_date":
        data.sort(key=lambda x: x.get("created_date", ""), reverse=True)
    if limit:
        data = data[:limit]
    return data

@app.get("/recommendations/{item_id}")
def get_recommendation(item_id: int):
    item = find_by_id(recommendations, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return item

@app.post("/recommendations")
def create_recommendation(payload: RecommendationCreate):
    new_id = max([r["id"] for r in recommendations], default=0) + 1
    item = payload.model_dump()
    item["id"] = new_id
    item["created_date"] = datetime.now(timezone.utc).isoformat()
    recommendations.append(item)
    return item

@app.patch("/recommendations/{item_id}")
def update_recommendation(item_id: int, payload: RecommendationPatch):
    item = find_by_id(recommendations, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    item.update(payload.model_dump(exclude_unset=True))
    return item

@app.delete("/recommendations/{item_id}")
def delete_recommendation(item_id: int):
    item = find_by_id(recommendations, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    recommendations.remove(item)
    return {"status": "deleted"}

@app.post("/ai/assign-officer")
def assign_officer(payload: AutoAssignRequest):
    incident = find_by_id(incidents, payload.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    ranked = rank_officers_for_incident(incident)
    if not ranked:
        raise HTTPException(status_code=400, detail="No suitable officers available")

    chosen = ranked[0]
    incident["assigned_officer"] = chosen["name"]
    incident["status"] = "responding"

    officer = find_by_id(officers, chosen["id"])
    if officer:
        officer["status"] = "responding"

    return {
        "officer_id": chosen["id"],
        "officer_name": chosen["name"],
        "badge_id": chosen["badge_id"],
        "score": chosen["score"],
        "distance_km": chosen["distance_km"],
        "reasoning": f"Assigned {chosen['name']} based on strongest combined proximity and specialization score."
    }

@app.post("/ai/optimize-route")
def optimize_route(payload: OptimizeRouteRequest):
    officer = find_by_id(officers, payload.officer_id)
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    route = build_patrol_route(officer)
    return {
        "route": route,
        "reasoning": "Route is ordered by incident severity first, then travel distance, followed by preventive checkpoint coverage."
    }

@app.get("/")
def root():
    return {"message": "Certis backend is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

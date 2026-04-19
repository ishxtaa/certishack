from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import uuid
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# -------- LOGIN --------
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login")
def login(data: LoginRequest):
    if data.email == "admin@certis.local" and data.password == "admin123":
        return {"status": "success", "message": "Login successful"}
    return {"status": "error", "message": "Invalid credentials"}

@app.post("/auth/login")
def auth_login(data: LoginRequest):
    if data.email == "admin@certis.local" and data.password == "admin123":
        return {"status": "success", "message": "Login successful"}
    return {"status": "error", "message": "Invalid credentials"}

@app.get("/auth/me")
def get_me():
    return {"id": "1", "email": "admin@certis.local", "name": "Admin"}


# -------- INCIDENT ANALYSIS --------
class IncidentRequest(BaseModel):
    events: list[str]

@app.post("/analyze")
def analyze(data: IncidentRequest):
    events = data.events
    if "motion_detected" in events and "access_denied" in events:
        return {
            "incident": "Unauthorized Entry",
            "severity": "High",
            "score": 85,
            "recommendations": ["Dispatch patrol", "Lock nearby access points"]
        }
    return {
        "incident": "Low Risk Activity",
        "severity": "Low",
        "score": 20,
        "recommendations": ["Monitor situation"]
    }


# -------- TIMELINE --------
class TimelineRequest(BaseModel):
    events: list[str]

@app.post("/timeline")
def timeline(data: TimelineRequest):
    return {"summary": f"Incident detected involving: {', '.join(data.events)}"}


# -------- FEEDBACK --------
feedback_storage = []

@app.post("/save-feedback")
def save_feedback(data: dict):
    feedback_storage.append(data)
    return {"status": "saved", "data": data}


# -------- INCIDENTS --------
incidents_storage = [
    {
        "id": "1",
        "title": "Unauthorized Entry Attempt",
        "type": "security",
        "severity": 8,
        "status": "active",
        "location_name": "Terminal A Gate 3",
        "description": "Motion detected after access denied at restricted area",
        "created_date": "2026-04-12T22:00:00"
    }
]

@app.get("/incidents")
def list_incidents():
    return incidents_storage

@app.post("/incidents")
def create_incident(data: dict):
    incidents_storage.append(data)
    return data

@app.patch("/incidents/{incident_id}")
def update_incident(incident_id: str, data: dict):
    for i, inc in enumerate(incidents_storage):
        if inc["id"] == incident_id:
            incidents_storage[i].update(data)
            return incidents_storage[i]
    return {"error": "Not found"}


# -------- OFFICERS --------
officers_storage = [
    {"id": "1", "name": "Officer Tan", "status": "available", "location": "Terminal A", "badge": "T001"},
    {"id": "2", "name": "Officer Lim", "status": "available", "location": "Terminal B", "badge": "T002"},
    {"id": "3", "name": "Officer Ahmad", "status": "on_patrol", "location": "Gate 3", "badge": "T003"},
]

@app.get("/officers")
def list_officers():
    return officers_storage

@app.post("/officers")
def create_officer(data: dict):
    data["id"] = str(uuid.uuid4())
    officers_storage.append(data)
    return data

@app.patch("/officers/{officer_id}")
def update_officer(officer_id: str, data: dict):
    for i, off in enumerate(officers_storage):
        if off["id"] == officer_id:
            officers_storage[i].update(data)
            return officers_storage[i]
    return {"error": "Not found"}


# -------- RECOMMENDATIONS --------
recommendations_storage = []

@app.get("/recommendations")
def list_recommendations():
    return recommendations_storage

@app.post("/recommendations")
def create_recommendation(data: dict):
    data["id"] = str(uuid.uuid4())
    recommendations_storage.append(data)
    return data

@app.patch("/recommendations/{rec_id}")
def update_recommendation(rec_id: str, data: dict):
    for i, rec in enumerate(recommendations_storage):
        if rec["id"] == rec_id:
            recommendations_storage[i].update(data)
            return recommendations_storage[i]
    return {"error": "Not found"}


# -------- AI GENERATE (Groq) --------
@app.post("/ai/generate")
async def ai_generate(data: dict):
    prompt = data.get("prompt", "")
    groq_api_key = os.getenv("GROQ_API_KEY")
    system_prompt = "You are a helpful AI assistant for airport security operations. Be concise and professional. Respond ONLY with valid JSON, no markdown, no explanation."

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {groq_api_key}"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1000
            },
            timeout=30.0
        )

    result = response.json()
    text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    text = text.strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()
    try:
        return {"result": json.loads(text)}
    except:
        return {"result": text}
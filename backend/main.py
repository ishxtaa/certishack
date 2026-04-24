from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import jwt
import sqlite3
import json
import httpx
import os
from datetime import datetime, timedelta
from typing import Optional, List, Any
from pydantic import BaseModel

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, use system env vars

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = "certis-hackathon-secret-key-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3"  # Change to any model you have pulled e.g. mistral, phi3
DB_PATH = "certis.db"

# ── Database ──────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'officer'
        );

        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            severity REAL NOT NULL,
            status TEXT DEFAULT 'active',
            location_name TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            assigned_officer TEXT,
            alerts TEXT DEFAULT '[]',
            narrative TEXT,
            post_analysis TEXT,
            timestamp TEXT,
            officer_feedback TEXT DEFAULT '[]',
            created_date TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS officers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            badge_id TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'available',
            current_zone TEXT,
            latitude REAL,
            longitude REAL,
            specialization TEXT DEFAULT 'general'
        );

        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id TEXT NOT NULL,
            action_text TEXT NOT NULL,
            predicted_outcome TEXT NOT NULL,
            confidence REAL NOT NULL,
            priority TEXT NOT NULL,
            feedback TEXT DEFAULT 'pending',
            officer_notes TEXT DEFAULT '[]',
            outcome_actual TEXT,
            created_date TEXT DEFAULT (datetime('now'))
        );
    """)

    # Seed default admin user (password: admin123)
    import hashlib
    pw = hashlib.sha256("admin123".encode()).hexdigest()
    c.execute("INSERT OR IGNORE INTO users (email, full_name, password, role) VALUES (?,?,?,?)",
              ("admin@certis.local", "Admin Officer", pw, "admin"))

    # Remove old incidents with wrong coordinates
    c.execute("DELETE FROM incidents WHERE title LIKE '%Package at Terminal A%' OR title LIKE '%Parking Garage%'")
    
    # Seed or update incidents with correct Changi Airport coordinates
    incidents_data = [
        ("Suspicious Package at Terminal 1", "Unattended bag reported near Gate 12",
         "unattended_bag", 7, "active", "Terminal 1 - Gate 12", 1.3610, 103.9900,
         "Officer Johnson",
         json.dumps([{"source": "CCTV Camera 12", "message": "Object left unattended for 5+ minutes", "timestamp": datetime.now().isoformat()}]),
         "A black suitcase was reported unattended near Gate 12.", None),
        ("Medical Emergency - Terminal 2", "Passenger collapsed near food court",
         "medical", 8, "responding", "Terminal 2 - Food Court", 1.3640, 103.9915,
         "Officer Smith",
         json.dumps([{"source": "Panic Button", "message": "Medical assistance requested", "timestamp": datetime.now().isoformat()}]),
         "Medical emergency reported. Paramedics responding.", None),
        ("Fire Alarm - Terminal 3 Parking", "Smoke detected in Level 2 parking area",
         "fire_alarm", 9, "contained", "Terminal 3 - Parking Level 2", 1.3660, 103.9930,
         "Officer Williams",
         json.dumps([{"source": "Fire Detection System", "message": "Smoke alarm triggered", "timestamp": datetime.now().isoformat()}]),
         "Fire alarm triggered in parking garage.", "False alarm - burnt food from vehicle."),
        ("Unauthorized Access - Security Checkpoint", "Individual attempted to enter secure area",
         "access_violation", 6, "resolved", "Security Checkpoint A", 1.3620, 103.9890,
         "Officer Davis",
         json.dumps([{"source": "Access Control System", "message": "Unauthorized badge swipe attempt", "timestamp": datetime.now().isoformat()}]),
         "Individual without proper credentials attempted to access restricted area.", "Subject was new employee who misplaced badge."),
        ("Theft Report - Baggage Claim", "Passenger reported missing luggage",
         "theft", 5, "active", "Terminal 2 - Baggage Claim 3", 1.3650, 103.9920,
         "Officer Miller",
         json.dumps([{"source": "Passenger Report", "message": "Baggage theft reported", "timestamp": datetime.now().isoformat()}]),
         "Passenger reported missing black suitcase. Reviewing CCTV footage.", None),
        ("VIP Escort Required - Terminal 1", "Diplomatic delegation arriving",
         "vip_movement", 4, "active", "Terminal 1 - Arrival Hall", 1.3612, 103.9902,
         "Officer Chen",
         json.dumps([{"source": "Protocol Office", "message": "VIP arrival in 30 minutes", "timestamp": datetime.now().isoformat()}]),
         "Diplomatic security detail required for incoming delegation.", None),
        ("Lost Child - Terminal 3", "5-year-old separated from parents",
         "lost_person", 6, "responding", "Terminal 3 - Departure Hall", 1.3662, 103.9932,
         "Officer Lee",
         json.dumps([{"source": "Panic Button", "message": "Child missing for 10 minutes", "timestamp": datetime.now().isoformat()}]),
         "Child wearing red shirt, last seen near check-in counter.", None),
        ("Flight Delay Crowd Control - Terminal 2", "Passengers agitated due to 6-hour delay",
         "crowd_control", 4, "responding", "Terminal 2 - Gate B12", 1.3642, 103.9912,
         "Officer Patel",
         json.dumps([{"source": "Airline Desk", "message": "Passengers becoming disruptive", "timestamp": datetime.now().isoformat()}]),
         "Crowd management needed at delayed flight gate.", None),
        ("Drug Detection Alert - Baggage Hall", "K9 unit detected suspicious substance",
         "contraband", 8, "active", "Baggage Hall - Belt 4", 1.3648, 103.9918,
         "Officer Taylor",
         json.dumps([{"source": "K9 Unit", "message": "Positive drug detection alert", "timestamp": datetime.now().isoformat()}]),
         "Baggage flagged for secondary screening. Awaiting inspection.", None),
        ("Power Outage - Control Tower", "Backup systems activated",
         "infrastructure", 9, "contained", "Control Tower - Level 3", 1.3602, 103.9882,
         "Officer Garcia",
         json.dumps([{"source": "Engineering", "message": "Power fluctuation detected", "timestamp": datetime.now().isoformat()}]),
         "Temporary power outage. Backup generators operational.", "Systems restored, investigation ongoing"),
        ("Airside Intrusion - Runway", "Unauthorized vehicle on taxiway",
         "security_breach", 10, "active", "Runway 2 - Taxiway Charlie", 1.3635, 103.9910,
         "Officer Brown",
         json.dumps([{"source": "ATC", "message": "Unauthorized vehicle detected", "timestamp": datetime.now().isoformat()}]),
         "Ground service vehicle entered restricted area. Runway closed pending clearance.", None),
    ]
    
    for inc in incidents_data:
        title, desc, typ, sev, status, loc_name, lat, lng, officer, alerts, narrative, post_analysis = inc
        # Check if incident exists by title (exact match)
        existing = c.execute("SELECT id FROM incidents WHERE title=?", (title,)).fetchone()
        if existing:
            # Update coordinates and location
            c.execute("UPDATE incidents SET location_name=?, latitude=?, longitude=? WHERE title=?",
                     (loc_name, lat, lng, title))
        else:
            # Try to find by location name pattern (for existing incidents with different titles)
            existing_by_loc = c.execute("SELECT id FROM incidents WHERE location_name LIKE ?", (f"%{loc_name.split(' - ')[0]}%",)).fetchone()
            if existing_by_loc:
                # Update existing incident with new title and coordinates
                c.execute("UPDATE incidents SET title=?, location_name=?, latitude=?, longitude=? WHERE id=?",
                         (title, loc_name, lat, lng, existing_by_loc[0]))
            else:
                # Insert new incident
                c.execute("""INSERT INTO incidents
                    (title,description,type,severity,status,location_name,latitude,longitude,
                     assigned_officer,alerts,narrative,post_analysis,timestamp,officer_feedback)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (title, desc, typ, sev, status, loc_name, lat, lng, officer, alerts, narrative, post_analysis, datetime.now().isoformat(), json.dumps([])))

    # Seed or update officers with correct Changi Airport coordinates
    officers_data = [
        ("Officer Johnson", "APD-4521", "responding", "Terminal 1", 1.3610, 103.9900, "general"),
        ("Officer Smith",   "APD-4522", "responding", "Terminal 2", 1.3640, 103.9915, "medical"),
        ("Officer Williams","APD-4523", "available",  "Terminal 3", 1.3660, 103.9930, "fire"),
        ("Officer Davis",   "APD-4524", "on_patrol",  "Concourse A", 1.3620, 103.9890, "tactical"),
        ("Officer Miller",  "APD-4525", "responding", "Concourse B", 1.3650, 103.9920, "general"),
        ("Officer Garcia",  "APD-4526", "available",  "Control Tower", 1.3600, 103.9880, "k9"),
        ("Officer Chen",    "APD-4527", "available",  "Terminal 1", 1.3615, 103.9905, "general"),
        ("Officer Patel",   "APD-4528", "on_patrol",  "Terminal 2", 1.3645, 103.9920, "medical"),
        ("Officer Lee",     "APD-4529", "responding", "Terminal 3", 1.3665, 103.9935, "tactical"),
        ("Officer Brown",   "APD-4530", "available",  "Concourse A", 1.3625, 103.9895, "fire"),
        ("Officer Wilson",  "APD-4531", "on_patrol",  "Security Checkpoint B", 1.3630, 103.9900, "general"),
        ("Officer Taylor",  "APD-4532", "responding", "Baggage Hall", 1.3648, 103.9918, "k9"),
    ]
    
    for officer in officers_data:
        name, badge_id, status, zone, lat, lng, spec = officer
        # Check if officer exists
        existing = c.execute("SELECT id FROM officers WHERE badge_id=?", (badge_id,)).fetchone()
        if existing:
            # Update coordinates and zone
            c.execute("UPDATE officers SET current_zone=?, latitude=?, longitude=? WHERE badge_id=?",
                     (zone, lat, lng, badge_id))
        else:
            # Insert new officer
            c.execute("INSERT INTO officers (name,badge_id,status,current_zone,latitude,longitude,specialization) VALUES (?,?,?,?,?,?,?)", officer)

    if c.execute("SELECT COUNT(*) FROM recommendations").fetchone()[0] == 0:
        recs = [
            ("1", "Evacuate immediate area within 50m and call bomb squad", "Ensures passenger safety", 95, "critical", "pending", None, None),
            ("2", "Clear pathway for paramedics and establish crowd control", "Facilitates rapid medical response", 92, "high", "accepted", "Action taken immediately", "Patient stabilized"),
            ("3", "Evacuate parking garage and notify fire department", "Ensures safety of all personnel", 98, "critical", "accepted", "Evacuation completed smoothly", "False alarm, all clear"),
            ("5", "Review CCTV footage from past 2 hours", "Identify suspect and track luggage", 85, "medium", "pending", None, None),
        ]
        c.executemany("INSERT INTO recommendations (incident_id,action_text,predicted_outcome,confidence,priority,feedback,officer_notes,outcome_actual) VALUES (?,?,?,?,?,?,?,?)", recs)

    # Ensure all recommendations have officer_notes as valid JSON array
    c.execute("UPDATE recommendations SET officer_notes = '[]' WHERE officer_notes IS NULL")

    conn.commit()
    conn.close()

# ── Auth ──────────────────────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)

def create_token(user_id: int, email: str) -> str:
    payload = {"sub": str(user_id), "email": email, "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: sqlite3.Connection = Depends(get_db)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(row)

# ── Helpers ───────────────────────────────────────────────────────────────────
def row_to_dict(row) -> dict:
    d = dict(row)
    for field in ("alerts", "officer_feedback"):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = []
    return d

# ── App ───────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Certis Security API", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Auth routes ───────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    # Password is already hashed by frontend
    pw = req.password
    row = db.execute("SELECT * FROM users WHERE email=? AND password=?", (req.email, pw)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = dict(row)
    token = create_token(user["id"], user["email"])
    return {"access_token": token, "token_type": "bearer", "user": {k: user[k] for k in ("id","email","full_name","role")}}

@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {k: current_user[k] for k in ("id","email","full_name","role")}

# ── Incident routes ───────────────────────────────────────────────────────────
class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[float] = None
    status: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    assigned_officer: Optional[str] = None
    alerts: Optional[Any] = None
    narrative: Optional[str] = None
    post_analysis: Optional[str] = None
    timestamp: Optional[str] = None
    officer_feedback: Optional[Any] = None

@app.get("/incidents")
def list_incidents(sort: Optional[str] = "-created_date", limit: Optional[int] = 50, db=Depends(get_db)):
    order = "DESC" if sort and sort.startswith("-") else "ASC"
    field = sort.lstrip("-") if sort else "created_date"
    rows = db.execute(f"SELECT * FROM incidents ORDER BY {field} {order} LIMIT ?", (limit,)).fetchall()
    return [row_to_dict(r) for r in rows]

@app.get("/incidents/{incident_id}")
def get_incident(incident_id: int, db=Depends(get_db)):
    row = db.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return row_to_dict(row)

@app.patch("/incidents/{incident_id}")
def update_incident(incident_id: int, data: IncidentUpdate, db=Depends(get_db)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    for field in ("alerts", "officer_feedback"):
        if field in updates and isinstance(updates[field], (list, dict)):
            updates[field] = json.dumps(updates[field])
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    sets = ", ".join(f"{k}=?" for k in updates)
    db.execute(f"UPDATE incidents SET {sets} WHERE id=?", (*updates.values(), incident_id))
    db.commit()
    return get_incident(incident_id, db)

# ── Officer routes ────────────────────────────────────────────────────────────
class OfficerUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    current_zone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    specialization: Optional[str] = None

@app.get("/officers")
def list_officers(db=Depends(get_db)):
    rows = db.execute("SELECT * FROM officers").fetchall()
    return [dict(r) for r in rows]

@app.patch("/officers/{officer_id}")
def update_officer(officer_id: int, data: OfficerUpdate, db=Depends(get_db)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    sets = ", ".join(f"{k}=?" for k in updates)
    db.execute(f"UPDATE officers SET {sets} WHERE id=?", (*updates.values(), officer_id))
    db.commit()
    row = db.execute("SELECT * FROM officers WHERE id=?", (officer_id,)).fetchone()
    return dict(row)

# ── Recommendation routes ─────────────────────────────────────────────────────
class RecommendationCreate(BaseModel):
    incident_id: str
    action_text: str
    predicted_outcome: str
    confidence: float
    priority: str
    feedback: Optional[str] = "pending"
    officer_notes: Optional[str] = None
    outcome_actual: Optional[str] = None

class RecommendationUpdate(BaseModel):
    action_text: Optional[str] = None
    predicted_outcome: Optional[str] = None
    confidence: Optional[float] = None
    priority: Optional[str] = None
    feedback: Optional[str] = None
    officer_notes: Optional[str] = None
    outcome_actual: Optional[str] = None

@app.get("/recommendations")
def list_recommendations(limit: Optional[int] = 50, db=Depends(get_db)):
    rows = db.execute("SELECT * FROM recommendations ORDER BY created_date DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]

@app.post("/recommendations")
def create_recommendation(data: RecommendationCreate, db=Depends(get_db)):
    c = db.execute("""INSERT INTO recommendations
        (incident_id,action_text,predicted_outcome,confidence,priority,feedback,officer_notes,outcome_actual)
        VALUES (?,?,?,?,?,?,?,?)""",
        (data.incident_id, data.action_text, data.predicted_outcome, data.confidence,
         data.priority, data.feedback, data.officer_notes, data.outcome_actual))
    db.commit()
    row = db.execute("SELECT * FROM recommendations WHERE id=?", (c.lastrowid,)).fetchone()
    return dict(row)

@app.patch("/recommendations/{rec_id}")
def update_recommendation(rec_id: int, data: RecommendationUpdate, db=Depends(get_db)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    sets = ", ".join(f"{k}=?" for k in updates)
    db.execute(f"UPDATE recommendations SET {sets} WHERE id=?", (*updates.values(), rec_id))
    db.commit()
    row = db.execute("SELECT * FROM recommendations WHERE id=?", (rec_id,)).fetchone()
    return dict(row)

# ── LLM route (Ollama) ────────────────────────────────────────────────────────
class LLMRequest(BaseModel):
    prompt: str
    response_json_schema: Optional[dict] = None

# ── Groq API Key ──────────────────────────────────────────────────────────────
# Get your free API key at: https://console.groq.com/keys
# Add GROQ_API_KEY=your_key_here to a .env file in the backend folder
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

@app.post("/llm/invoke")
async def invoke_llm(req: LLMRequest):
    """Call Groq API for LLM inference"""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured. Please set GROQ_API_KEY in main.py")
    
    system_prompt = "You are an AI assistant for airport security operations. Be concise and professional."
    if req.response_json_schema:
        system_prompt += " Respond ONLY with valid JSON, no markdown, no explanation."
    
    try:
        # Use Groq API via httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2048
                }
            )
            
            if response.status_code != 200:
                error_detail = response.json().get("error", {}).get("message", "Unknown error")
                raise HTTPException(status_code=response.status_code, detail=f"Groq API error: {error_detail}")
            
            result = response.json()
            content = result["choices"][0]["message"]["content"].strip()
        
        # Remove markdown code fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        if req.response_json_schema:
            try:
                return json.loads(content)
            except Exception:
                return {"response": content}

        return {"response": content}

    except Exception as e:
        import traceback
        print(f"[LLM] Groq error: {str(e)}")
        print(f"[LLM] Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")

@app.get("/health")
def health():
    return {"status": "ok"}

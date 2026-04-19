# Sentinel: Airport Security Command Platform

Built for the NAISC Certis Hackathon.

A real-time security operations dashboard for *airport* environments, featuring AI-powered tactical recommendations, incident management, patrol routing, voice feedback, and post-incident analysis. It is designed to help group officers optimise their resources and target incidents more effectively.

---

## Features

- **Command Centre**: Live incident feed, interactive map, officer tracking, severity analytics
- **AI Recommendations**: Context-aware tactical recommendations powered by Groq AI 
- **Voice Feedback**: Officers can record voice notes that are automatically transcribed to text using Groq Whisper API
- **Text-to-Speech**:Listen to recommendations and feedback aloud
- **Timeline**: Chronological incident history and audit trail
- **Patrol Routes**:Officer assignment and patrol management with AI-optimised routing
- **Post-Incident Analysis**: AI-generated training reports for resolved incidents

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** FastAPI, SQLite, Python 3.12
- **Data fetching:** TanStack Query
- **AI:** Groq API (llama-3.1-8b-instant for chat, whisper-large-v3 for transcription)
- **Maps:** React Leaflet
- **Auth:** JWT with SHA256 password hashing

---

## Prerequisites

- Node.js 18+
- Python 3.12+
- Groq API key (get free at https://console.groq.com/keys)

---

## Getting Started

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd certishack
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Set up backend virtual environment:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

4. Create a `.env` file in the root with your Groq API key:
   ```env
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

5. Start the backend:
   ```bash
   cd backend
   venv\Scripts\activate
   uvicorn main:app --reload --port 8000
   ```

6. In a new terminal, start the frontend:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`.

---

## Project Structure

```
certishack/
├── backend/                  # FastAPI backend
│   ├── main.py              # FastAPI app with Groq integration
│   ├── requirements.txt     # Python dependencies
│   └── certis.db           # SQLite database
├── src/
│   ├── api/
│   │   └── openaiClient.js  # REST client for backend & Groq API
│   ├── components/
│   │   ├── dashboard/       # StatusCard, LiveFeed, SeverityChart, OfficerFeedback
│   │   ├── layout/          # AppLayout, Sidebar, TopBar
│   │   ├── map/             # IncidentMap (Leaflet)
│   │   └── ui/              # shadcn/ui component library
│   ├── lib/
│   │   ├── AuthContext.js   # Auth state & login/logout
│   │   └── securityUtils.js # Shared security utilities
│   └── pages/
│       ├── dashboard.jsx    # Command Center
│       ├── recommendations.jsx  # AI Recommendations
│       ├── timeline.jsx     # Incident timeline
│       ├── patrolroutes.jsx # Patrol management
│       ├── postanalysis.jsx # Post-incident AI reports
│       └── login.jsx        # Login page
└── README.md
```

---

## Environment Variables

Create a `.env` file in the root directory:

| Variable | Description | Required |
|---|---|---|
| `VITE_GROQ_API_KEY` | Groq API key for AI features | Yes |

Get your free API key at: https://console.groq.com/keys

---

## Voice Feedback Feature

Officers can now record voice feedback on recommendations:

1. Click **Voice Note** button on any recommendation
2. Speak your observation
3. Click **Stop**: the audio is automatically transcribed using Groq Whisper API
4. The transcribed text is saved to that specific recommendation
5. Click the **speaker icon** to listen to any feedback aloud

---

## Default Login

- **Email:** admin@certis.local
- **Password:** admin123

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |


---

## API Endpoints

The backend provides RESTful APIs:

- `GET /incidents` — List all incidents
- `POST /incidents` — Create new incident
- `PATCH /incidents/{id}` — Update incident
- `GET /recommendations` — List AI recommendations
- `POST /recommendations/generate` — Generate new recommendations
- `PATCH /recommendations/{id}` — Update recommendation feedback
- `GET /officers` — List all officers
- `POST /auth/login` — User login
- `POST /auth/register` — User registration

---

## License

Built for NAISC Certis Hackathon 2026.

# CertisHack — Airport Security Command Platform

Built for the NAISC Certis Hackathon.

A real-time security operations dashboard for airport environments, featuring AI-powered tactical recommendations, incident management, patrol routing, and post-incident analysis.

---

## Features

- **Command Center** — Live incident feed, interactive map, officer tracking, severity analytics
- **AI Recommendations** — Context-aware tactical recommendations powered by Pollinations.AI (free, no API key required), with support for live sensor dataset input
- **Sensor Dataset Input** — Inject real-time sensor readings (crowd density, environmental, perimeter, passenger flow) to make AI recommendations data-driven
- **Timeline** — Chronological incident history and audit trail
- **Patrol Routes** — Officer assignment and patrol management
- **Post-Incident Analysis** — AI-generated training reports for resolved incidents

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Data fetching:** TanStack Query
- **AI:** [Pollinations.AI](https://pollinations.ai) — free, no API key needed
- **Backend:** FastAPI (separate repo) — proxied via `/api`
- **Maps:** React Leaflet

---

## Prerequisites

- Node.js 18+
- A running instance of the CertisHack FastAPI backend on `http://localhost:8000`

---

## Getting Started

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd certishack
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file and configure the backend URL:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

---

## Sensor Dataset Input

On the **AI Recommendations** page, expand the **Sensor Dataset Input** panel to feed live sensor readings into the AI engine. Readings are sent as structured context alongside the incident data, producing more specific and actionable recommendations.

**Input methods:**
- **Quick Presets** — one-click load for common sensor categories (Crowd Density, Environmental, Perimeter, Passenger Flow)
- **Manual entry** — add individual `key: value` sensor fields
- **CSV import** — paste rows in `key,value` format to bulk-import from any monitoring system

Each generated recommendation will include a **sensor context note** indicating which readings influenced it.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000` |

No AI API keys are required — the app uses [Pollinations.AI](https://text.pollinations.ai) which is free and open.

---

## Project Structure

```
src/
├── api/
│   ├── base44Client.js     # REST client for backend entities & auth
│   └── openaiClient.js     # LLM client (Pollinations.AI, free)
├── components/
│   ├── dashboard/          # StatusCard, LiveFeed, SeverityChart, etc.
│   ├── layout/             # AppLayout, Sidebar, TopBar
│   ├── map/                # IncidentMap (Leaflet)
│   └── ui/                 # shadcn/ui component library
├── lib/
│   ├── AuthContext.jsx      # Auth state & login/logout
│   └── securityUtils.js    # Shared security utilities
├── pages/
│   ├── dashboard.jsx        # Command Center
│   ├── recommendations.jsx  # AI Recommendations + Sensor Input
│   ├── timeline.jsx         # Incident timeline
│   ├── patrolroutes.jsx     # Patrol management
│   ├── postanalysis.jsx     # Post-incident AI reports
│   └── login.jsx            # Login page
└── App.jsx
```

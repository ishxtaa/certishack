# CertisHack Backend

FastAPI backend for the CertisHack security command platform.  
Data is stored in-memory — restarting the server resets to seed data.

## Setup

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be available at http://localhost:8000

## Default Login

| Field    | Value                |
|----------|----------------------|
| Email    | admin@certis.local   |
| Password | admin123             |

## Endpoints

| Method | Path                        | Description          |
|--------|-----------------------------|----------------------|
| POST   | /auth/login                 | Login, returns token |
| GET    | /auth/me                    | Current user info    |
| GET    | /incidents                  | List incidents       |
| POST   | /incidents                  | Create incident      |
| PATCH  | /incidents/{id}             | Update incident      |
| DELETE | /incidents/{id}             | Delete incident      |
| GET    | /officers                   | List officers        |
| POST   | /officers                   | Create officer       |
| PATCH  | /officers/{id}              | Update officer       |
| GET    | /recommendations            | List recommendations |
| POST   | /recommendations            | Create recommendation|
| PATCH  | /recommendations/{id}       | Update recommendation|

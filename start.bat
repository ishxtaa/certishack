@echo off
echo Starting Certis Hackathon App...

:: Start FastAPI backend
echo [1/2] Starting FastAPI backend...
start "FastAPI Backend" cmd /k "cd /d c:\Users\ishita\OneDrive\Documents\certis.hackathon\certishack\backend && uvicorn main:app --reload --port 8000"

:: Wait for backend to start
timeout /t 3 /nobreak > nul

:: Start Vite frontend
echo [2/2] Starting Vite frontend...
start "Vite Frontend" cmd /k "cd /d c:\Users\ishita\OneDrive\Documents\certis.hackathon\certishack && npm run dev"

echo.
echo All services starting...
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo.
echo Login: admin@certis.local / admin123
echo AI: Using Groq API (llama-3.1-8b-instant)
pause

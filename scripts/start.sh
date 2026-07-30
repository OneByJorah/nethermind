#!/bin/bash
# nethermind — Start both backend and frontend services
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "╔══════════════════════════════════════════╗"
echo "║   nethermind — Starting Services        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Backend ──
echo "→ Starting backend (port 8000)..."
cd "$BACKEND_DIR"
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  ✓ Created .env from .env.example"
    echo "  ⚠ Edit .env to add your OPENAI_API_KEY and SSH credentials"
fi
source venv/bin/activate 2>/dev/null || true
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  ✓ Backend PID: $BACKEND_PID"

# ── Frontend ──
echo "→ Starting frontend (port 3000)..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo "  ✓ Frontend PID: $FRONTEND_PID"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Services Running                       ║"
echo "║                                          ║"
echo "║   Dashboard:  http://localhost:3000       ║"
echo "║   API:        http://localhost:8000       ║"
echo "║   API Docs:   http://localhost:8000/docs  ║"
echo "║                                          ║"
echo "║   Press Ctrl+C to stop both              ║"
echo "╚══════════════════════════════════════════╝"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

#!/bin/bash
echo "============================================"
echo " Nethermind Desktop - Starting Application"
echo "============================================"
echo ""

cd "$(dirname "$0")"

echo "[1/3] Installing Electron dependencies if needed..."
if [ ! -d "node_modules" ]; then
    npm install
fi

echo ""
echo "[2/3] Starting Nethermind Desktop..."
echo ""
echo "Backend will start on http://localhost:8000"
echo "Frontend will start on http://localhost:3000"
echo ""

npx electron .

echo ""
echo "[3/3] Application closed."

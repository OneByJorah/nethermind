#!/bin/bash
set -e

echo "============================================"
echo " Nethermind Desktop - Linux Build"
echo "============================================"
echo ""

cd "$(dirname "$0")"

echo "[1/4] Installing Electron dependencies..."
npm install

echo ""
echo "[2/4] Building frontend for production..."
cd ../frontend
npm run build

echo ""
echo "[3/4] Building Linux packages..."
cd ../desktop
npx electron-builder --linux --x64

echo ""
echo "[4/4] Build complete!"
echo ""
echo "Output files are in: desktop/dist/"
echo ""
echo "Available packages:"
echo "  - Nethermind-*-x64.AppImage  (Universal Linux)"
echo "  - Nethermind-*-x64.deb       (Debian/Ubuntu)"
echo "  - Nethermind-*-x64.rpm       (Fedora/RHEL)"
echo ""

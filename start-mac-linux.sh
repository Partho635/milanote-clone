#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Download it from https://nodejs.org"; exit 1; }
[ -d node_modules ] || { echo "Installing packages..."; npm install; }
[ -f .next/BUILD_ID ] || { echo "Building the app..."; npm run build; }
( sleep 3; (open http://localhost:3000 || xdg-open http://localhost:3000) >/dev/null 2>&1 ) &
npm start

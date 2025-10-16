#!/bin/bash

# Check External API Service on Port 4000
# Created: 13.10.2025 - MCP Fix Session

echo "═══════════════════════════════════════════════════════════════"
echo "  Checking External API Service (Port 4000)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if port 4000 is listening
echo "1️⃣  PORT 4000 STATUS:"
echo "─────────────────────────────────────────────────────────"
if lsof -i :4000 > /dev/null 2>&1; then
    echo "✅ Port 4000 is OPEN"
    echo ""
    echo "Process details:"
    lsof -i :4000
else
    echo "❌ Port 4000 is NOT listening"
    echo ""
    echo "This API is required for:"
    echo "  - Stage 0 mode selection (classification)"
    echo "  - Stage 0 chat responses"
    echo "  - MCP workflow LLM reasoning"
fi
echo ""

# Test health endpoint
echo "2️⃣  API HEALTH CHECK:"
echo "─────────────────────────────────────────────────────────"
if curl -s --max-time 2 http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ Health endpoint responding"
    curl -s http://localhost:4000/health | head -5
elif curl -s --max-time 2 http://localhost:4000/ > /dev/null 2>&1; then
    echo "⚠️  Root endpoint responding but no /health"
    curl -s http://localhost:4000/ | head -5
else
    echo "❌ No response from http://localhost:4000"
    echo ""
    echo "Possible causes:"
    echo "  1. API server not started"
    echo "  2. Using OpenRouter/external API (needs configuration)"
    echo "  3. Using local LLM (llama.cpp, ollama, etc) not running"
fi
echo ""

# Test models endpoint
echo "3️⃣  MODELS ENDPOINT:"
echo "─────────────────────────────────────────────────────────"
if curl -s --max-time 2 http://localhost:4000/v1/models > /dev/null 2>&1; then
    echo "✅ Models endpoint responding"
    echo ""
    echo "Available models (first 5):"
    curl -s http://localhost:4000/v1/models | jq -r '.data[0:5][] | "  - \(.id)"' 2>/dev/null || echo "  (Could not parse models list)"
else
    echo "❌ Models endpoint not responding"
fi
echo ""

# Check environment variables
echo "4️⃣  ENVIRONMENT CONFIGURATION:"
echo "─────────────────────────────────────────────────────────"
if [ -f .env ]; then
    echo "✅ .env file found"
    echo ""
    echo "API-related configuration:"
    grep -E "(API|LLM|MODEL)" .env | grep -v "^#" || echo "  (No API config in .env)"
else
    echo "❌ No .env file found"
fi
echo ""

# Recommendations
echo "═══════════════════════════════════════════════════════════════"
echo "📋 RECOMMENDATIONS:"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if ! lsof -i :4000 > /dev/null 2>&1; then
    echo "⚠️  Port 4000 API is NOT running. You have 3 options:"
    echo ""
    echo "Option 1: Use OpenRouter (Cloud API)"
    echo "─────────────────────────────────────────────────────────"
    echo "  1. Get API key from https://openrouter.ai/"
    echo "  2. Add to .env:"
    echo "     OPENROUTER_API_KEY=sk-or-v1-YOUR-KEY-HERE"
    echo "  3. Run: npm start api-proxy  # Starts proxy on port 4000"
    echo ""
    echo "Option 2: Use Local LLM (llama.cpp / ollama)"
    echo "─────────────────────────────────────────────────────────"
    echo "  Ollama:"
    echo "    1. Install: brew install ollama"
    echo "    2. Start: ollama serve  # Default port 11434"
    echo "    3. Run proxy: npm start api-proxy -- --upstream http://localhost:11434"
    echo ""
    echo "  llama.cpp:"
    echo "    1. Build: cd third_party/llama.cpp && make server"
    echo "    2. Start: ./server -m models/model.gguf --port 4000"
    echo ""
    echo "Option 3: Quick Test - Use Direct Goose"
    echo "─────────────────────────────────────────────────────────"
    echo "  Temporarily bypass port 4000 by disabling mode selection:"
    echo "  1. Edit: config/workflow-config.js"
    echo "  2. Comment out stage 0 (mode_selection)"
    echo "  3. All requests go directly to stage 1 (Goose workflow)"
    echo ""
    echo "  OR set in .env:"
    echo "     AI_BACKEND_MODE=goose  # Skip mode selection, use Goose only"
else
    echo "✅ Port 4000 is running - orchestrator should work"
    echo ""
    echo "If you still see errors:"
    echo "  1. Check API authentication (API key required?)"
    echo "  2. Check model availability: curl http://localhost:4000/v1/models"
    echo "  3. Test chat endpoint: curl -X POST http://localhost:4000/v1/chat/completions \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"model\":\"openai/gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"test\"}]}'"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"

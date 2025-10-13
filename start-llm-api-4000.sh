#!/bin/bash

# Quick Start: LLM API на порті 4000 для ATLAS MCP Workflow
# Created: 13.10.2025 - Port 4000 Protection Fix

echo "════════════════════════════════════════════════════════════════"
echo "  ATLAS MCP Workflow - Quick Start LLM API (Port 4000)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if port 4000 is already running
if ! lsof -i :4000 > /dev/null 2>&1; then
    echo "❌ Port 4000 is NOT running"
    echo ""
    echo "Choose an option to start LLM API on port 4000:"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Option 1: Ollama (Recommended for Mac M1/M2)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1. Install Ollama:"
    echo "     brew install ollama"
    echo ""
    echo "  2. Start Ollama:"
    echo "     ollama serve &"
    echo ""
    echo "  3. Pull a model:"
    echo "     ollama pull llama3.2:3b"
    echo ""
    echo "  4. Test:"
    echo "     curl http://localhost:11434/v1/models"
    echo ""
    echo "  5. Configure ATLAS to use Ollama:"
    echo "     Edit config/global-config.js:"
    echo "     apiEndpoint: 'http://localhost:11434/v1/chat/completions'"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Option 2: llama.cpp Server"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1. Build llama.cpp:"
    echo "     cd third_party/llama.cpp"
    echo "     make server"
    echo ""
    echo "  2. Download a model:"
    echo "     mkdir -p models"
    echo "     # Download GGUF model from HuggingFace"
    echo ""
    echo "  3. Start server on port 4000:"
    echo "     ./server -m models/your-model.gguf --port 4000 --host 127.0.0.1"
    echo ""
    echo "  4. Test:"
    echo "     curl http://localhost:4000/v1/models"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Option 3: OpenRouter Proxy (Cloud API)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1. Get API key from https://openrouter.ai/"
    echo ""
    echo "  2. Add to .env:"
    echo "     OPENROUTER_API_KEY=sk-or-v1-YOUR-KEY-HERE"
    echo ""
    echo "  3. Install proxy dependencies:"
    echo "     npm install express axios dotenv"
    echo ""
    echo "  4. Create proxy server (proxy-4000.js):"
    echo "     See full script below"
    echo ""
    echo "  5. Start proxy:"
    echo "     node proxy-4000.js &"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Option 4: Use Existing LiteLLM Proxy"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  If you already have LiteLLM proxy running:"
    echo ""
    echo "  1. Update config/global-config.js:"
    echo "     apiEndpoint: 'http://localhost:YOUR_LITELLM_PORT/v1/chat/completions'"
    echo ""
    echo "  2. Or set port to 4000:"
    echo "     litellm --port 4000"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    
    # Ask user which option to use
    read -p "Which option do you want to use? (1-4, or 'skip'): " choice
    
    case $choice in
        1)
            echo ""
            echo "Starting Ollama setup..."
            if ! command -v ollama >/dev/null 2>&1; then
                echo "Installing Ollama..."
                brew install ollama
            fi
            echo "Starting Ollama server..."
            ollama serve > /dev/null 2>&1 &
            sleep 2
            echo "✅ Ollama server started on port 11434"
            echo ""
            echo "⚠️  NOTE: Ollama uses port 11434 by default."
            echo "Update config/global-config.js:"
            echo "  apiEndpoint: 'http://localhost:11434/v1/chat/completions'"
            ;;
        2)
            echo ""
            echo "⚠️  llama.cpp requires manual setup."
            echo "Follow the instructions above."
            ;;
        3)
            echo ""
            echo "⚠️  OpenRouter requires API key."
            echo "Follow the instructions above."
            ;;
        4)
            echo ""
            echo "⚠️  Using existing LiteLLM proxy."
            echo "Make sure it's running!"
            ;;
        skip)
            echo ""
            echo "Skipping LLM API setup."
            echo "⚠️  WARNING: MCP workflow will NOT work without port 4000!"
            ;;
        *)
            echo ""
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
else
    echo "✅ Port 4000 is already running!"
    echo ""
    echo "Process details:"
    lsof -i :4000
    echo ""
    echo "Testing API..."
    if curl -s --max-time 2 http://localhost:4000/health > /dev/null 2>&1; then
        echo "✅ API health check passed"
    elif curl -s --max-time 2 http://localhost:4000/v1/models > /dev/null 2>&1; then
        echo "✅ API models endpoint responding"
        echo ""
        echo "Available models:"
        curl -s http://localhost:4000/v1/models | jq -r '.data[0:5][] | "  - \(.id)"' 2>/dev/null || echo "  (Could not parse models list)"
    else
        echo "⚠️  API not responding to health/models endpoints"
        echo "Make sure your LLM API is running correctly"
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Next Steps:"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  1. Verify API is working:"
echo "     ./check-api-4000.sh"
echo ""
echo "  2. Start ATLAS system:"
echo "     ./restart_system.sh restart"
echo ""
echo "  3. Test MCP workflow:"
echo "     ./test-mcp-json-fix.sh"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📚 Documentation:"
echo "  - docs/PORT_4000_PROTECTION_FIX_2025-10-13.md"
echo "  - check-api-4000.sh (diagnostic tool)"
echo "  - MCP_TROUBLESHOOTING_GUIDE.md"
echo ""
echo "════════════════════════════════════════════════════════════════"

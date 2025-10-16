#!/bin/bash

# MCP Servers Verification Script
# Verifies all 6 MCP servers are properly configured and documented
# Date: October 14, 2025

echo "🔍 MCP SERVERS VERIFICATION"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected servers and tool counts
declare -A EXPECTED_SERVERS=(
    ["filesystem"]=14
    ["playwright"]=32
    ["shell"]=9
    ["applescript"]=1
    ["git"]=27
    ["memory"]=9
)

TOTAL_EXPECTED_TOOLS=92
TOTAL_SERVERS=6

echo "📋 Expected Configuration:"
echo "   - Servers: ${TOTAL_SERVERS}"
echo "   - Tools: ${TOTAL_EXPECTED_TOOLS}"
echo ""

# Check prompts
echo "1️⃣  Checking Prompts..."
echo "-------------------"

PROMPT_FILES=(
    "prompts/mcp/tetyana_plan_tools.js"
    "prompts/mcp/grisha_verify_item.js"
    "prompts/mcp/atlas_todo_planning.js"
)

for file in "${PROMPT_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -n "   ${file##*/}: "
        
        # Check for all 6 servers
        has_all_servers=true
        for server in "${!EXPECTED_SERVERS[@]}"; do
            if ! grep -q "\"$server\"" "$file" && ! grep -q "\*\*$server\*\*" "$file"; then
                echo -e "${RED}✗ Missing $server${NC}"
                has_all_servers=false
                break
            fi
        done
        
        if $has_all_servers; then
            echo -e "${GREEN}✓ All 6 servers present${NC}"
        fi
    else
        echo -e "   ${file##*/}: ${RED}✗ File not found${NC}"
    fi
done

echo ""

# Check copilot instructions
echo "2️⃣  Checking Documentation..."
echo "-------------------------"

if [ -f ".github/copilot-instructions.md" ]; then
    echo -n "   copilot-instructions.md: "
    
    # Check for 6/6 servers mention
    if grep -q "6/6 MCP servers" ".github/copilot-instructions.md"; then
        echo -e "${GREEN}✓ 6/6 servers documented${NC}"
    else
        echo -e "${RED}✗ Missing 6/6 servers reference${NC}"
    fi
    
    # Check for 92 tools mention
    echo -n "   Tool count (92): "
    if grep -q "92 tools" ".github/copilot-instructions.md"; then
        echo -e "${GREEN}✓ Present${NC}"
    else
        echo -e "${YELLOW}⚠ Missing 92 tools reference${NC}"
    fi
else
    echo -e "   copilot-instructions.md: ${RED}✗ File not found${NC}"
fi

echo ""

# Check processor code
echo "3️⃣  Checking Processor Code..."
echo "--------------------------"

PROCESSOR="orchestrator/workflow/stages/tetyana-plan-tools-processor.js"
if [ -f "$PROCESSOR" ]; then
    echo -n "   ${PROCESSOR##*/}: "
    
    # Check for applescript in default tools
    if grep -q "applescript" "$PROCESSOR"; then
        echo -e "${GREEN}✓ AppleScript in default tools${NC}"
    else
        echo -e "${RED}✗ Missing AppleScript${NC}"
    fi
else
    echo -e "   ${PROCESSOR##*/}: ${RED}✗ File not found${NC}"
fi

echo ""

# Summary
echo "📊 SUMMARY"
echo "=========="
echo ""
echo "Expected Servers (6):"
for server in "${!EXPECTED_SERVERS[@]}"; do
    count=${EXPECTED_SERVERS[$server]}
    printf "   %-15s %2d tools\n" "$server" "$count"
done
echo "   --------------------------------"
echo "   Total:          ${TOTAL_EXPECTED_TOOLS} tools"
echo ""

# Check if running (optional - requires system to be running)
if command -v lsof &> /dev/null; then
    echo "4️⃣  Runtime Status (optional)..."
    echo "----------------------------"
    
    if lsof -ti:5101 > /dev/null 2>&1; then
        echo -e "   Orchestrator: ${GREEN}✓ Running on port 5101${NC}"
        
        # Try to check MCP status via logs (if available)
        if [ -f "logs/orchestrator.log" ]; then
            echo -n "   MCP Initialization: "
            if tail -100 logs/orchestrator.log | grep -q "MCP Manager.*servers started"; then
                echo -e "${GREEN}✓ Servers started${NC}"
            else
                echo -e "${YELLOW}⚠ Check logs for details${NC}"
            fi
        fi
    else
        echo -e "   Orchestrator: ${YELLOW}⚠ Not running${NC}"
    fi
    echo ""
fi

echo "✅ Verification complete!"
echo ""
echo "For detailed report, see: MCP_SERVERS_VERIFICATION_2025-10-14.md"

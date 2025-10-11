#!/bin/bash
# Quick Prompts & Workflow Validation
# Швидка перевірка системи промптів

echo "🔍 ATLAS Quick Validation"
echo "══════════════════════════════════════"
echo ""

# 1. Audit prompts
echo "1️⃣  Checking prompts structure..."
node scripts/audit-prompts.js
echo ""

# 2. Run all tests
echo "2️⃣  Running comprehensive tests..."
bash tests/test-all-prompts.sh
echo ""

echo "══════════════════════════════════════"
echo "✅ Validation complete!"
echo ""
echo "For detailed quality report:"
echo "  node scripts/analyze-prompts-quality.js"

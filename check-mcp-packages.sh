#!/bin/bash

echo "🔍 Checking MCP package availability..."
echo ""

# Масив пакетів для перевірки
packages=(
  "@modelcontextprotocol/server-filesystem"
  "@executeautomation/playwright-mcp-server"
  "super-shell-mcp"
  "@mseep/applescript-mcp"
  "@wipiano/github-mcp-lightweight"
  "@cyanheads/git-mcp-server"
  "@modelcontextprotocol/server-memory"
)

failed=0

for package in "${packages[@]}"; do
  echo -n "Checking $package... "
  
  # Спробувати отримати інформацію про пакет
  if npm view "$package" version >/dev/null 2>&1; then
    version=$(npm view "$package" version 2>/dev/null)
    echo "✅ Available (v$version)"
  else
    echo "❌ NOT FOUND in npm registry"
    failed=$((failed + 1))
  fi
done

echo ""
if [ $failed -eq 0 ]; then
  echo "✅ All MCP packages are available"
  exit 0
else
  echo "⚠️ $failed package(s) not found - some MCP servers may fail to start"
  exit 1
fi

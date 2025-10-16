# Git MCP Server Crash - Quick Reference
**Date:** 17.10.2025  
**Status:** DISABLED (broken package)

---

## 🔴 Problem
`@cyanheads/git-mcp-server` crashes on startup:
```
Error flushing main logger: Error: the worker has exited
```

## 🎯 Root Cause
Pino multi-threaded logger + STDIO protocol = conflict

## ✅ Solution
Git server **DISABLED** in `config/global-config.js`

## 🔧 Alternative - Shell Git
```javascript
// All git operations through shell MCP server:
shell__execute_command({ command: 'git status' })
shell__execute_command({ command: 'git add .' })
shell__execute_command({ command: 'git commit -m "message"' })
shell__execute_command({ command: 'git push origin main' })
```

## 📊 Current State
```
✅ 5/5 operational servers (65 tools)
- filesystem: 14 tools
- playwright: 32 tools
- shell: 9 tools (includes git)
- applescript: 1 tool
- memory: 9 tools

❌ git: DISABLED (was crashing)
```

## 🧪 Verify
```bash
# Check git disabled
grep "git:" config/global-config.js | grep "/\*"

# System starts clean
./restart_system.sh status
# Should show: 5/5 servers started
```

## ⚠️ Critical
- **DON'T** re-enable git server without fix
- **USE** shell commands for git operations
- **PATTERN:** `shell__execute_command({ command: 'git <cmd>' })`

---

**Full details:** `docs/GIT_MCP_SERVER_CRASH_2025-10-17.md`

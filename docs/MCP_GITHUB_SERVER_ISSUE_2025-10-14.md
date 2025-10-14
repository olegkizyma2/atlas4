# MCP GitHub Server Issue - Analysis & Resolution

**Date:** 14.10.2025 ~13:00  
**Status:** ❌ DISABLED (server causes orchestrator crash)  
**Affected:** GitHub MCP server (@wipiano/github-mcp-lightweight v0.1.1)

---

## 📋 Problem Summary

**Issue:** GitHub MCP server causes orchestrator to **crash during initialization**

**Symptoms:**
- Orchestrator exits with code 1 when starting GitHub server
- No error messages - silent crash
- Other 6 servers initialize successfully
- GitHub server hangs and blocks entire orchestrator startup

**Evidence:**
```
[MCP Manager] Starting applescript...
[MCP applescript] Initializing...
[MCP Manager] Starting github...
[exit 1] ← Orchestrator crashes here
```

---

## 🔍 Root Cause Analysis

### Investigation Steps:

1. **Token Validation:** ✅ GITHUB_TOKEN valid
   ```bash
   curl -H "Authorization: token gho_Dwte..." https://api.github.com/user
   # Returns: login: olegkizyma2 ✓
   ```

2. **Package Existence:** ✅ Package exists in npm
   ```bash
   npm search @wipiano/github-mcp-lightweight
   # Version: 0.1.1 published 2025-06-23 ✓
   ```

3. **Manual Test:** ❌ FAILS - server hangs
   ```bash
   GITHUB_TOKEN="gho_..." npx -y @wipiano/github-mcp-lightweight
   # Output: "GitHub Lightweight MCP server running on stdio"
   # Then: HANGS waiting for stdin (never responds to initialize)
   ```

4. **Protocol Version:** Tried fix - no effect
   - Changed protocolVersion: '1.0' → '2024-11-05' 
   - Changed response detection (SDK 0.6.x vs 1.x compatibility)
   - **Result:** Still crashes

5. **SDK Version Mismatch:** ⚠️ POSSIBLE CAUSE
   ```
   @wipiano/github-mcp-lightweight: @modelcontextprotocol/sdk@^0.6.0
   @modelcontextprotocol/server-filesystem: @modelcontextprotocol/sdk@^1.17.0
   ```
   Difference: SDK 0.6.0 (old) vs 1.17.0 (current)

### Root Cause:
**Package bug or incompatibility** - GitHub MCP server v0.1.1:
- Starts successfully ("server running on stdio")
- **Never responds to initialize request** through stdin
- Causes orchestrator to hang forever
- Eventually triggers timeout or crash

---

## ✅ Resolution

### Temporary Solution: DISABLE GitHub Server

**Config change** (`config/global-config.js`):
```javascript
// DISABLED 14.10.2025: GitHub MCP server (@wipiano/github-mcp-lightweight v0.1.1) 
// зависає при ініціалізації з GITHUB_TOKEN, спричиняє крах orchestrator
// TODO: Спробувати альтернативний пакет або оновлену версію
/*
github: {
  command: 'npx',
  args: ['-y', '@wipiano/github-mcp-lightweight'],
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || ''
  }
},
*/
```

**Result:**
- ✅ Orchestrator starts successfully
- ✅ 6/6 operational servers (was 6/7)
- ✅ 92+ tools available (filesystem 14, playwright 32, shell 9, applescript 1, git 27, memory 9)
- ✅ System fully functional WITHOUT GitHub automation

---

## 🔧 Attempted Fixes (Unsuccessful)

### Fix #1: Protocol Version Update
**Change:** `protocolVersion: '1.0'` → `'2024-11-05'`  
**File:** `orchestrator/ai/mcp-manager.js`  
**Result:** ❌ No effect - still crashes

### Fix #2: SDK Compatibility Layer
**Change:** Support both response formats (SDK 0.6.x and 1.x)
```javascript
// Old: message.result.capabilities
// New: message.result?.capabilities || message.capabilities
```
**File:** `orchestrator/ai/mcp-manager.js`  
**Result:** ❌ No effect - server never responds

### Fix #3: Extended Timeout
**Already in place:** 15s timeout (was 5s)  
**Result:** ❌ Server hangs indefinitely, no response even after 15s

---

## 📊 Current MCP Status

### ✅ Operational Servers (6/6):

1. **filesystem:** 14 tools
   - create_file, write_file, read_file, delete_file, etc.

2. **playwright:** 32 tools
   - browser_open, screenshot, web_scrape, click, type, etc.

3. **shell:** 9 tools
   - run_shell_command, run_applescript, etc.

4. **applescript:** 1 tool
   - execute_applescript (macOS GUI automation)

5. **git:** 27 tools (async loading shows 0 initially)
   - git_status, git_commit, git_push, git_pull, etc.

6. **memory:** 9 tools
   - store_memory, retrieve_memory, search_memory, etc.

### ❌ Failed Server (DISABLED):

7. **github:** DISABLED
   - Package: @wipiano/github-mcp-lightweight v0.1.1
   - Issue: Initialization hang → orchestrator crash
   - Status: Commented out in config

---

## 🔄 Future Solutions

### Option 1: Alternative Package
Try different GitHub MCP package:
- `@modelcontextprotocol/server-github` (official?)
- Other community packages with SDK 1.x support

### Option 2: Update Package
Wait for @wipiano/github-mcp-lightweight update:
- SDK upgrade: 0.6.0 → 1.17.0
- Bug fixes for initialization hang

### Option 3: Custom Implementation
Create own GitHub MCP wrapper:
- Use Octokit (official GitHub API client)
- Implement MCP protocol manually
- Ensure SDK 1.x compatibility

### Option 4: Direct GitHub API Integration
Bypass MCP for GitHub operations:
- Use Goose Desktop + GitHub extension
- Or integrate Octokit directly in orchestrator
- No MCP layer needed

---

## ✅ System Status After Fix

**Before:**
- 6/7 servers running
- GitHub initialization hanging
- Orchestrator crashes on startup
- System unusable

**After:**
- ✅ 6/6 servers running (100% of configured)
- ✅ Orchestrator starts successfully
- ✅ All MCP automation working
- ✅ 92+ tools available
- ✅ System fully operational

**Trade-off:**
- ❌ No GitHub MCP automation (issues, PRs, repos)
- ✅ All other automation works perfectly
- ✅ Can still use Goose for GitHub tasks
- ✅ Direct API integration possible

---

## 📝 Implementation Notes

### Files Modified:

1. **config/global-config.js**
   - Commented out github server config
   - Added TODO note for future fix

2. **orchestrator/ai/mcp-manager.js**
   - Updated protocol version (doesn't fix GitHub but improves compatibility)
   - Added SDK 0.6.x/1.x response format support

### Testing:
```bash
# Verify orchestrator starts
cd /Users/dev/Documents/GitHub/atlas4
timeout 25 node orchestrator/server.js 2>&1 | grep "servers started"
# Expected: "✅ 6/6 servers started"

# Verify GitHub is disabled
grep -A 5 "github:" config/global-config.js
# Expected: Commented out section with DISABLED note
```

---

## 🎯 Recommendations

1. **Short-term:** Keep GitHub disabled until package update
2. **Medium-term:** Monitor @wipiano/github-mcp-lightweight for updates
3. **Long-term:** Evaluate alternative GitHub MCP packages
4. **Fallback:** Use Goose Desktop GitHub extension for GitHub tasks

**Priority:** LOW - system works without GitHub MCP, other 6 servers provide complete automation

---

## 📚 Related Documentation

- `docs/MCP_APPLESCRIPT_FIX_2025-10-14.md` - AppleScript package fix
- `docs/MCP_AUTOMATION_COMPLETE_2025-10-14.md` - Complete MCP automation
- `.github/copilot-instructions.md` - Updated system status (6/7 → 6/6)

---

**Conclusion:** GitHub MCP server disabled due to initialization bug. System fully operational with 6/6 servers providing 92+ tools for complete automation.

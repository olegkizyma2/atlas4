# 🔄 MCP Tool Flow: Диаграммы и последовательности

## Диаграмма 1: Полный цикл tool-based выполнения

```
┌──────────────────────────────────────────────────────────────────────┐
│                     MCP Tool Execution Cycle                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PHASE 1: PLANNING (Tetyana)                                         │
│  ────────────────────────────────                                    │
│                                                                      │
│  ┌─────────────────────────────────┐                                │
│  │   TODO Item & Success Criteria  │                                │
│  └────────────────┬────────────────┘                                │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────┐                                │
│  │ MCPManager.getToolsSummary()    │  getAvailableTools() или      │
│  │ (92 tools formatted as text)    │  getDetailedToolsSummary()    │
│  └────────────────┬────────────────┘                                │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐            │
│  │ tetyana_plan_tools.js (Prompt)                      │            │
│  │ ┌─────────────────────────────────────────────────┐ │            │
│  │ │ System: You are Tetyana...                      │ │            │
│  │ │                                                 │ │            │
│  │ │ Available MCP Tools:                            │ │            │
│  │ │ {{AVAILABLE_TOOLS}} ← 92+ tools text here!     │ │            │
│  │ │                                                 │ │            │
│  │ │ Examples:                                       │ │            │
│  │ │ - shell.execute_command                         │ │            │
│  │ │ - playwright.screenshot                         │ │            │
│  │ │ - filesystem.write_file                         │ │            │
│  │ │                                                 │ │            │
│  │ │ Return ONLY JSON with tool_calls array          │ │            │
│  │ └─────────────────────────────────────────────────┘ │            │
│  │ User: Open calculator, compute 333×2=666           │            │
│  └────────────────┬─────────────────────────────────────┘            │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────┐                                │
│  │ LLM @ localhost:4000            │                                │
│  │ (gpt-4o-mini, T=0.3)            │                                │
│  └────────────────┬────────────────┘                                │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────────────────┐                    │
│  │ Tetyana's Tool Plan (JSON):                 │                    │
│  │ {                                           │                    │
│  │   "tool_calls": [                           │                    │
│  │     {"server":"applescript","tool":...},    │                    │
│  │     {"server":"shell","tool":...},          │                    │
│  │     {"server":"playwright","tool":...}      │                    │
│  │   ]                                         │                    │
│  │ }                                           │                    │
│  └────────────────┬────────────────────────────┘                    │
│                   │                                                  │
│  PHASE 2: EXECUTION (Tetyana)                                        │
│  ──────────────────────────────                                     │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────┐                                │
│  │ For each tool_call in plan:     │                                │
│  │ ┌───────────────────────────────┤                                │
│  │ │ server: "shell"               │                                │
│  │ │ tool: "execute_command"       │                                │
│  │ │ params: {command: "..."}      │                                │
│  │ └───────────────────────────────┤                                │
│  └────────────────┬────────────────┘                                │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────┐                                │
│  │ MCPManager.executeTool()        │                                │
│  │ (stdio to shell server)          │                                │
│  └────────────────┬────────────────┘                                │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────┐                                │
│  │ Tool Result:                    │                                │
│  │ {success: true, result: {...}}  │                                │
│  │ {success: false, error: "..."}  │                                │
│  └────────────────┬────────────────┘                                │
│                   │                                                  │
│                   ▼                                                  │
│  ┌─────────────────────────────────────────────┐                    │
│  │ Execution Results Collected:                │                    │
│  │ {                                           │                    │
│  │   "results": [                              │                    │
│  │     {tool: "...", success: true, result:{}},│                    │
│  │     {tool: "...", success: true, result:{}} │                    │
│  │   ],                                        │                    │
│  │   "all_successful": true                    │                    │
│  │ }                                           │                    │
│  └────────────────┬────────────────────────────┘                    │
│                   │                                                  │
│  PHASE 3: VERIFICATION PLANNING (Grisha)                             │
│  ──────────────────────────────────────                              │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────┐                           │
│  │ Grisha gets Tetyana's execution      │                           │
│  │ results + success criteria           │                           │
│  └────────────────┬─────────────────────┘                           │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────┐                           │
│  │ grisha_verify_item.js (Prompt)       │                           │
│  │ ┌──────────────────────────────────┐ │                           │
│  │ │ System: You are Grisha...        │ │                           │
│  │ │                                  │ │                           │
│  │ │ ⚠️ MANDATORY: screenshot always! │ │                           │
│  │ │                                  │ │                           │
│  │ │ Available Tools:                 │ │                           │
│  │ │ {{AVAILABLE_TOOLS}} ← tools      │ │                           │
│  │ │ Available for verification       │ │                           │
│  │ │                                  │ │                           │
│  │ │ Return ONLY JSON with            │ │                           │
│  │ │ verification tool_calls          │ │                           │
│  │ └──────────────────────────────────┘ │                           │
│  │ User: Verify calc shows 333×2=666    │                           │
│  │       Evidence: [results]            │                           │
│  └────────────────┬─────────────────────┘                           │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────┐                           │
│  │ LLM @ localhost:4000                 │                           │
│  │ (gpt-4o-mini, T=0.3)                 │                           │
│  └────────────────┬─────────────────────┘                           │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────┐                           │
│  │ Grisha's Verification Plan:          │                           │
│  │ {                                    │                           │
│  │   "tool_calls": [                    │                           │
│  │     {"server": "shell",              │                           │
│  │      "tool": "execute_command",      │                           │
│  │      "params": {"command":           │                           │
│  │        "screencapture /tmp/v.png"}}, │                           │
│  │     {"server": "shell", ...}         │                           │
│  │   ]                                  │                           │
│  │ }                                    │                           │
│  └────────────────┬─────────────────────┘                           │
│                   │                                                  │
│  PHASE 4: VERIFICATION EXECUTION (Grisha)                            │
│  ────────────────────────────────────────                            │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────┐                           │
│  │ For each verification tool_call:     │                           │
│  │ MCPManager.executeTool()              │                           │
│  │                                      │                           │
│  │ Results include:                     │                           │
│  │ - screenshot.png (binary data)       │                           │
│  │ - file contents (text)               │                           │
│  │ - command output                     │                           │
│  └────────────────┬─────────────────────┘                           │
│                   │                                                  │
│  PHASE 5: VERIFICATION ANALYSIS (Grisha)                             │
│  ──────────────────────────────────────                              │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────────┐                       │
│  │ LLM Analysis:                            │                       │
│  │ - Read REAL screenshot image data        │                       │
│  │ - Compare to success criteria            │                       │
│  │ - Make YES/NO decision                   │                       │
│  └────────────────┬───────────────────────┘                        │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────────┐                       │
│  │ FINAL DECISION:                          │                       │
│  │ {                                        │                       │
│  │   "verified": true/false,                │                       │
│  │   "reason": "Screenshot shows 333×2=666" │                       │
│  │ }                                        │                       │
│  └──────────────────────────────────────────┘                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Диаграмма 2: Data Structure Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ INPUT: TODO Item                                                │
├─────────────────────────────────────────────────────────────────┤
│ {                                                               │
│   "id": "item_1",                                               │
│   "action": "Open calculator and compute 333×2=666",           │
│   "success_criteria": "Result shows 666",                       │
│   "dependencies": [],                                           │
│   "max_attempts": 3                                             │
│ }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ planTools()      │
                    │ (Tetyana thinks) │
                    └────────┬─────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ PLANNING OUTPUT: Tool Plan                                       │
├─────────────────────────────────────────────────────────────────┤
│ {                                                               │
│   "tool_calls": [                                               │
│     {                                                           │
│       "server": "applescript",                                  │
│       "tool": "applescript_execute",                            │
│       "parameters": {                                           │
│         "code_snippet": "tell app \"Calculator\" to activate"   │
│       }                                                         │
│     },                                                          │
│     {                                                           │
│       "server": "shell",                                        │
│       "tool": "execute_command",                                │
│       "parameters": {                                           │
│         "command": "osascript -e 'tell app ...' && sleep 1"    │
│       }                                                         │
│     }                                                           │
│   ],                                                            │
│   "reasoning": "First activate app, then take screenshot"      │
│ }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼──────────┐
                    │ executeTools()    │
                    │ (Tetyana acts)    │
                    └────────┬──────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ EXECUTION OUTPUT: Execution Results                              │
├─────────────────────────────────────────────────────────────────┤
│ {                                                               │
│   "results": [                                                  │
│     {                                                           │
│       "tool": "applescript_execute",                            │
│       "server": "applescript",                                  │
│       "success": true,                                          │
│       "result": {"status": "App activated"}                     │
│     },                                                          │
│     {                                                           │
│       "tool": "execute_command",                                │
│       "server": "shell",                                        │
│       "success": true,                                          │
│       "result": {                                               │
│         "stdout": "Screenshot saved to /tmp/calc.png",         │
│         "stderr": "",                                           │
│         "exit_code": 0                                          │
│       }                                                         │
│     }                                                           │
│   ],                                                            │
│   "all_successful": true,                                       │
│   "tts_phrase": "Калькулятор открыт, скриншот сделан"        │
│ }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                   ┌─────────▼────────────┐
                   │ _planVerificationTools│
                   │ (Grisha plans check) │
                   └─────────┬────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│ VERIFICATION PLAN: What to check                                 │
├─────────────────────────────────────────────────────────────────┤
│ {                                                               │
│   "tool_calls": [                                               │
│     {                                                           │
│       "server": "shell",                                        │
│       "tool": "execute_command",                                │
│       "parameters": {                                           │
│         "command": "screencapture -x /tmp/verify.png"          │
│       }                                                         │
│     },                                                          │
│     {                                                           │
│       "server": "filesystem",                                   │
│       "tool": "read_file",                                      │
│       "parameters": {                                           │
│         "path": "/tmp/verify.png"                              │
│       }                                                         │
│     }                                                           │
│   ],                                                            │
│   "screenshot_required": true                                   │
│ }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────▼──────────────┐
                │ _executeVerificationTools │
                │ (Grisha gets evidence)    │
                └────────────┬──────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────────┐
│ VERIFICATION RESULTS: REAL DATA!                                  │
├──────────────────────────────────────────────────────────────────┤
│ {                                                                │
│   "results": [                                                   │
│     {                                                            │
│       "tool": "execute_command",                                 │
│       "server": "shell",                                         │
│       "success": true,                                           │
│       "result": {"stdout": "", "stderr": ""}                     │
│     },                                                           │
│     {                                                            │
│       "tool": "read_file",                                       │
│       "server": "filesystem",                                    │
│       "success": true,                                           │
│       "result": {                                                │
│         "content": "PNG_BINARY_DATA...",  ← REAL screenshot!     │
│         "size": 15234,                                           │
│         "encoding": "binary"                                     │
│       }                                                          │
│     }                                                            │
│   ]                                                              │
│ }                                                                │
└────────────────────────────┬───────────────────────────────────┘
                             │
              ┌──────────────▼───────────────┐
              │ _analyzeVerificationResults  │
              │ (Grisha analyzes evidence)   │
              └──────────────┬────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────┐
│ FINAL DECISION: VERIFIED / NOT VERIFIED                       │
├───────────────────────────────────────────────────────────────┤
│ {                                                             │
│   "verified": false,  ← Based on REAL screenshot analysis!    │
│   "reason": "Screenshot shows 333×333=333,333,333 ❌",        │
│   "expected": "333×2=666",                                    │
│   "confidence": 0.95                                          │
│ }                                                             │
└───────────────────────────────────────────────────────────────┘
```

---

## Диаграмма 3: MCP Manager Tool Distribution

```
┌────────────────────────────────────────────────────────────────────┐
│                     6 MCP SERVERS                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1️⃣  SHELL SERVER (9 tools)                                       │
│  ├─ execute_command                                               │
│  ├─ get_platform_info                                             │
│  ├─ get_whitelist                                                 │
│  ├─ add_to_whitelist                                              │
│  ├─ approve_command                                               │
│  ├─ deny_command                                                  │
│  ├─ run_shell_command                                             │
│  ├─ run_applescript                                               │
│  └─ get_working_directory                                         │
│                                                                    │
│  2️⃣  FILESYSTEM SERVER (14 tools)                                 │
│  ├─ read_file                                                     │
│  ├─ write_file                                                    │
│  ├─ list_directory                                                │
│  ├─ create_directory                                              │
│  ├─ delete_file                                                   │
│  ├─ delete_directory                                              │
│  ├─ get_file_info                                                 │
│  ├─ move_file                                                     │
│  ├─ copy_file                                                     │
│  ├─ search_files                                                  │
│  ├─ get_home_directory                                            │
│  ├─ get_current_directory                                         │
│  ├─ set_current_directory                                         │
│  └─ read_file_lines                                               │
│                                                                    │
│  3️⃣  PLAYWRIGHT SERVER (32 tools)                                 │
│  ├─ browser_launch                                                │
│  ├─ browser_close                                                 │
│  ├─ new_context                                                   │
│  ├─ new_page                                                      │
│  ├─ close_page                                                    │
│  ├─ navigate                                                      │
│  ├─ fill                                                          │
│  ├─ click                                                         │
│  ├─ type                                                          │
│  ├─ press                                                         │
│  ├─ screenshot                                                    │
│  ├─ get_text                                                      │
│  ├─ get_url                                                       │
│  ├─ get_title                                                     │
│  ├─ wait_for_element                                              │
│  ├─ evaluate                                                      │
│  ├─ add_init_script                                               │
│  ├─ remove_init_script                                            │
│  ├─ set_viewport_size                                             │
│  ├─ set_offline_mode                                              │
│  ├─ set_geolocation                                               │
│  ├─ set_permissions                                               │
│  ├─ grant_permissions                                             │
│  ├─ revoke_permissions                                            │
│  ├─ set_extra_http_headers                                        │
│  ├─ set_http_auth                                                 │
│  ├─ set_user_agent                                                │
│  ├─ set_color_scheme                                              │
│  ├─ set_timezone                                                  │
│  ├─ set_locale                                                    │
│  ├─ set_java_script_enabled                                       │
│  └─ expose_function                                               │
│                                                                    │
│  4️⃣  APPLESCRIPT SERVER (1 tool)                                  │
│  └─ applescript_execute                                           │
│                                                                    │
│  5️⃣  GIT SERVER (27 tools)                                        │
│  ├─ git_status                                                    │
│  ├─ git_add                                                       │
│  ├─ git_commit                                                    │
│  ├─ git_push                                                      │
│  ├─ git_pull                                                      │
│  ├─ git_branch                                                    │
│  ├─ git_checkout                                                  │
│  ├─ git_merge                                                     │
│  ├─ git_rebase                                                    │
│  ├─ git_stash                                                     │
│  ├─ git_log                                                       │
│  ├─ git_diff                                                      │
│  ├─ git_tag                                                       │
│  ├─ git_remote                                                    │
│  ├─ git_fetch                                                     │
│  ├─ git_clone                                                     │
│  ├─ git_init                                                      │
│  ├─ git_reset                                                     │
│  ├─ git_clean                                                     │
│  ├─ git_cherry_pick                                               │
│  ├─ git_blame                                                     │
│  ├─ git_show                                                      │
│  ├─ git_reflog                                                    │
│  ├─ git_worktree                                                  │
│  ├─ git_set_working_dir                                           │
│  └─ git_clear_working_dir                                         │
│                                                                    │
│  6️⃣  MEMORY SERVER (9 tools)                                      │
│  ├─ store_memory                                                  │
│  ├─ retrieve_memory                                               │
│  ├─ list_memories                                                 │
│  ├─ delete_memory                                                 │
│  ├─ update_memory                                                 │
│  ├─ search_memories                                               │
│  ├─ clear_all_memories                                            │
│  ├─ get_memory                                                    │
│  └─ memory_info                                                   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ TOTAL: 92 Tools                                                   │
│ - Tetyana uses: Typically 5-10 tools per task                     │
│ - Grisha uses: Typically 2-5 tools for verification               │
│ - Optimization: Pre-select servers to reduce LLM prompt 90%       │
└────────────────────────────────────────────────────────────────────┘
```

---

## Диаграмма 4: Pre-Selected Servers Optimization

```
WITHOUT Optimization:
─────────────────

planTools(item, todo, {})
  ↓
MCPManager.getToolsSummary()
  ↓
Returns ALL 92 tools in markdown format
  ↓
Prompt becomes ~500 tokens
  ↓
LLM processes large context
  ↓
Slower, more expensive


WITH Optimization (NEW - 16.10.2025):
───────────────────────────────────

planTools(item, todo, {
  selectedServers: ['shell', 'playwright']
})
  ↓
MCPManager.getToolsFromServers(['shell', 'playwright'])
  ↓
Returns ONLY 40 tools (shell 9 + playwright 32)
  ↓
Prompt becomes ~150 tokens (70% reduction!)
  ↓
LLM processes focused context
  ↓
Faster, cheaper, more accurate


FLOW:
─────

Stage 1 (Planning):
  ├─ Atlas analyzes task
  ├─ Determines which servers needed
  └─ Returns selectedServers: ['shell', 'playwright']
  
Stage 2.0 (Server Selection):
  ├─ Pre-selects relevant servers
  ├─ Passes to Stage 2.1
  └─ Avoids 92+ tools bombardment
  
Stage 2.1 (Tetyana Planning):
  ├─ Receives selectedServers parameter
  ├─ Calls MCPManager with filter
  ├─ Gets only 40 tools
  ├─ Gets ~150 token summary
  └─ LLM plans with focused context
  
Stage 2.2 (Execution):
  ├─ Executes planned tools
  └─ Results are specific and relevant
  
Stage 2.3 (Grisha Verification):
  ├─ Uses same selectedServers
  ├─ Gets focused verification tool set
  └─ Verification is precise
```

---

## Диаграмма 5: Обработка ошибок и fallbacks

```
┌─────────────────────────────────────────────────────────┐
│         ERROR HANDLING IN MCP EXECUTION                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  EXECUTION ERROR                                        │
│  ────────────────                                       │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────┐               │
│  │ catch (error) in executeTools()      │               │
│  │ ┌──────────────────────────────────┐ │               │
│  │ │ results.push({                   │ │               │
│  │ │   tool: toolCall.tool,           │ │               │
│  │ │   server: toolCall.server,       │ │               │
│  │ │   success: false,                │ │               │
│  │ │   error: error.message           │ │               │
│  │ │ })                               │ │               │
│  │ │ allSuccessful = false            │ │               │
│  │ └──────────────────────────────────┘ │               │
│  │ ✅ Continue with next tool!          │               │
│  └──────────────────────────────────────┘               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────┐               │
│  │ Return execution results:            │               │
│  │ {                                    │               │
│  │   results: [                         │               │
│  │     {success: true, ...},            │               │
│  │     {success: false, error: "..."},  │               │
│  │     {success: true, ...}             │               │
│  │   ],                                 │               │
│  │   all_successful: false  ← Key flag! │               │
│  │ }                                    │               │
│  └──────────────────────────────────────┘               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────┐               │
│  │ Grisha sees all_successful: false    │               │
│  │ ┌──────────────────────────────────┐ │               │
│  │ │ Plans verification with focus on │ │               │
│  │ │ FAILED tool results              │ │               │
│  │ │                                  │ │               │
│  │ │ "Tool X failed. Let me check..." │ │               │
│  │ └──────────────────────────────────┘ │               │
│  └──────────────────────────────────────┘               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────┐               │
│  │ Verification reveals actual issue:   │               │
│  │ - Tool execution failed (network)    │               │
│  │ - Tool execution failed (syntax)     │               │
│  │ - Tool execution failed (permission) │               │
│  └──────────────────────────────────────┘               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────┐               │
│  │ Grisha's Decision:                   │               │
│  │ verified: false                      │               │
│  │ reason: "Tool failed, see details..."│               │
│  │ evidence: [actual error data]        │               │
│  └──────────────────────────────────────┘               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────────────────────┐               │
│  │ Retry Logic (up to 3 attempts):      │               │
│  │ - Attempt 1: Failed                  │               │
│  │ - Attempt 2: Failed                  │               │
│  │ - Attempt 3: Failed                  │               │
│  │ → Task FAILED (reported to user)     │               │
│  └──────────────────────────────────────┘               │
│                                                         │
│ ✅ NO FALSE POSITIVES (graceful fallback fixed!)        │
│ ✅ Real error handling, not masking                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Практический Timeline

```
00:00  Task starts: "Open calculator, compute 333×2=666"
       
00:01  Stage 1: Atlas decides what to do
       ├─ Task type: execution (not chat)
       ├─ Required servers: applescript, shell, playwright
       └─ Sends to Stage 2
       
00:02  Stage 2.0: Pre-select servers
       ├─ Analysis: Need GUI automation + shell
       ├─ Selected: ["applescript", "shell", "playwright"]
       └─ Pass to Tetyana
       
00:03  Stage 2.1: Tetyana PLANS
       ├─ Gets 40-tool list (not 92)
       ├─ LLM processes quickly
       ├─ Plans: Open app → Take screenshot
       └─ Returns tool_calls
       
00:04  Stage 2.2: Tetyana EXECUTES
       ├─ applescript_execute: Open Calculator
       │  ✅ SUCCESS (0.5s)
       ├─ execute_command: screenshot
       │  ✅ SUCCESS (0.3s)
       └─ Total execution: 0.8s
       
00:05  Stage 2.3: Grisha VERIFIES
       ├─ Gets execution results
       ├─ Plans verification with 40 tools
       ├─ execute_command: Take verification screenshot
       │  ✅ SUCCESS (0.3s)
       └─ Screenshot file ready
       
00:06  Stage 3: Grisha ANALYZES
       ├─ LLM reads screenshot data
       ├─ Compares to "333×2=666"
       ├─ Screenshot shows: "333×333=333,333,333" ❌
       └─ verified: FALSE
       
00:07  Retry Logic Triggers
       ├─ Attempt 1: FAILED
       ├─ Back to Stage 2.0
       ├─ New plan: Clear, re-enter calculation
       └─ Attempt 2 starts
       
       ... (similar flow) ...
       
00:15  After 3 attempts: Task FAILED
       └─ Report to user: "Unable to get correct result"
       
```

---

**Диаграмма обновлена:** 16 октября 2025
**Статус:** ✅ Система готова к тестированию

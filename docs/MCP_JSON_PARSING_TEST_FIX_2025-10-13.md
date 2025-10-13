# MCP JSON Parsing Test Script Fix

**Date:** 13 October 2025, 21:55
**Issue:** Test script `test-mcp-json-fix.sh` had bash syntax errors preventing proper validation

## Problem

The test script was failing with errors like:
```bash
./test-mcp-json-fix.sh: line 73: [: 0
0: integer expression expected
```

### Root Causes

1. **Newline characters in variables**: `wc -l` output included newlines that weren't stripped
2. **Integer comparison errors**: Bash `[ -eq ]` failed when variables contained whitespace/newlines
3. **Missing error handling**: No `2>/dev/null` on grep operations that could fail
4. **No log files**: The orchestrator wasn't running, so logs directory was empty

### Symptoms

- Script showed "0\n0" instead of "0" for counts
- Integer expression errors on all comparisons
- Test always failed even when orchestrator not running

## Solution

### Fixed Variable Assignments

**Before:**
```bash
STAGE21_COUNT=$(grep -E "Stage 2.1.*item 1" logs/orchestrator.log | tail -20 | wc -l | tr -d ' ')
```

**After:**
```bash
STAGE21_COUNT=$(grep -E "Stage 2.1.*item 1" logs/orchestrator.log 2>/dev/null | tail -20 | wc -l | tr -d ' \n')
```

**Changes:**
- ✅ Added `2>/dev/null` to handle missing log files
- ✅ Added `\n` to `tr -d` to remove newlines
- ✅ Consistent pattern across all grep operations

### Fixed Integer Comparisons

**Before:**
```bash
if [ "$STAGE21_COUNT" -eq 1 ]; then
```

**After:**
```bash
if [ "$STAGE21_COUNT" = "1" ] 2>/dev/null; then
```

Or for more robust checking:
```bash
if [ -z "$STAGE22_COUNT" ] || [ "$STAGE22_COUNT" = "0" ]; then
```

**Changes:**
- ✅ Use string comparison `=` instead of integer `-eq`
- ✅ Add null/empty checks with `-z`
- ✅ Redirect errors with `2>/dev/null`

### Fixed Parse Error Check

**Before:**
```bash
PARSE_ERRORS=$(grep -c "Failed to parse tool plan" logs/orchestrator.log 2>/dev/null || echo "0")

if [ "$PARSE_ERRORS" -eq 0 ]; then
```

**After:**
```bash
PARSE_ERRORS=$(grep -c "Failed to parse tool plan" logs/orchestrator.log 2>/dev/null | tr -d ' \n' || echo "0")

if [ -z "$PARSE_ERRORS" ] || [ "$PARSE_ERRORS" = "0" ]; then
```

### Fixed Final Result Check

**Before:**
```bash
if [ "$STAGE21_COUNT" -eq 1 ] && [ "$PARSE_ERRORS" -eq 0 ] && [ "$STAGE22_COUNT" -gt 0 ]; then
```

**After:**
```bash
if [ "$STAGE21_COUNT" = "1" ] && ([ -z "$PARSE_ERRORS" ] || [ "$PARSE_ERRORS" = "0" ]) && [ ! -z "$STAGE22_COUNT" ] && [ "$STAGE22_COUNT" != "0" ]; then
```

## Result

✅ Test script now handles:
- Empty/missing log files gracefully
- Newlines and whitespace in grep output
- String comparisons for integer-like values
- Proper error messages when orchestrator not running

## Testing Instructions

```bash
# 1. Ensure orchestrator is running
./restart_system.sh status

# 2. If not running, start it
./restart_system.sh start

# 3. Run the fixed test
./test-mcp-json-fix.sh

# Expected output (if orchestrator running):
# ✅ Orchestrator is running
# 🚀 Sending test request...
# ⏳ Waiting 15 seconds...
# 📊 Analyzing logs...
# [Pass/fail results based on actual workflow]
```

## Related Issues

This fix is related to the MCP JSON Parsing Infinite Loop Fix (docs/MCP_JSON_PARSING_INFINITE_LOOP_FIX_2025-10-13.md), but focuses on making the **test script** robust rather than fixing the parsing logic itself.

## Critical Rules

1. ✅ **Always** strip newlines with `tr -d ' \n'` after `wc -l`
2. ✅ **Always** use `2>/dev/null` on grep operations that might fail
3. ✅ **Prefer** string comparison `=` over integer `-eq` for variable values
4. ✅ **Check** for null/empty values with `-z` before comparisons
5. ✅ **Handle** missing files gracefully with `|| echo "0"` fallbacks

## Bash Best Practices Applied

```bash
# Safe variable assignment pattern
VAR=$(command 2>/dev/null | tr -d ' \n' || echo "0")

# Safe integer-like comparison pattern
if [ -z "$VAR" ] || [ "$VAR" = "0" ]; then
    # Handle zero/empty case
fi

# Safe non-zero comparison pattern  
if [ ! -z "$VAR" ] && [ "$VAR" != "0" ]; then
    # Handle non-zero case
fi
```

---

**Updated:** 13 October 2025, 21:55
**Status:** ✅ Test script fixed and validated

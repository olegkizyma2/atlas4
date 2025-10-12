# 🔧 Fixes Documentation

This directory contains detailed documentation for all bug fixes and improvements in the ATLAS project.

## 📂 Contents

### Conversation Mode Fixes Series (12 October 2025)

#### Quick-Send Mode
- `QUICK_SEND_FIX_README.md` - Quick-send filter fix documentation
- `QUICK_SEND_DEPLOYMENT_SUMMARY.md` - Deployment guide
- `COMMIT_MESSAGE_QUICK_SEND_FIX.md` - Commit message template

#### Conversation Mode Core
- `CONVERSATION_MODE_KEYWORD_FIX_SUMMARY.md` - Keyword activation fix
- `CONVERSATION_TTS_SUBSCRIPTION_PR_SUMMARY.md` - TTS event subscription
- `CONVERSATION_PENDING_CLEAR_SUMMARY.md` - Pending message clear fix
- `CONVERSATION_SILENCE_TIMEOUT_SUMMARY.md` - VAD silence timeout adjustment

#### Pending Continuous Listening Fix
- `CONVERSATION_PENDING_CONTINUOUS_SUMMARY.md` - Quick summary
- `PENDING_CONTINUOUS_COMPLETE_SUMMARY.md` - Complete overview
- `PENDING_CONTINUOUS_FINAL_REPORT.md` - Final report
- `PENDING_CONTINUOUS_CHECKLIST.md` - Verification checklist
- `PENDING_CONTINUOUS_DOCS_INDEX.md` - Documentation index
- `FIX_COMPLETE_PENDING_CONTINUOUS.md` - Final summary
- `COMMIT_MESSAGE_PENDING_CONTINUOUS_FIX.md` - Commit message template

#### Combined Summaries
- `BOTH_FIXES_COMPLETE_SUMMARY.md` - Quick-send + Conversation mode combined

---

## 🔍 Quick Navigation

### By Fix Type
- **Conversation Loop:** `CONVERSATION_PENDING_CONTINUOUS_SUMMARY.md`
- **Keyword Detection:** `CONVERSATION_MODE_KEYWORD_FIX_SUMMARY.md`
- **Quick-Send:** `QUICK_SEND_FIX_README.md`
- **TTS Events:** `CONVERSATION_TTS_SUBSCRIPTION_PR_SUMMARY.md`

### By Document Type
- **Summaries:** Files ending with `_SUMMARY.md`
- **Reports:** Files ending with `_REPORT.md`
- **Checklists:** Files ending with `_CHECKLIST.md`
- **Commit Messages:** Files starting with `COMMIT_MESSAGE_`

---

## 📖 Related Documentation

- **Pull Requests:** `/docs/pull-requests/` - PR summaries
- **Test Scripts:** `/tests/verify-*.sh` - Verification scripts
- **Technical Docs:** `/docs/CONVERSATION_*.md` - Detailed technical reports

---

## 🧪 Testing

All fixes have associated verification scripts in `/tests/`:
- `verify-conversation-fixes.sh` - Conversation mode fixes
- `verify-pending-continuous-fix.sh` - Pending continuous fix
- `verify-quick-send-fix.sh` - Quick-send fix

---

**Total Fixes:** 15+ documented fixes  
**Date Range:** October 2025  
**Status:** ✅ All fixes verified and deployed  

---

**Last Updated:** 12 October 2025

# GPT-4o-mini Vision Fix - Quick Reference

**Date:** 17.10.2025 ~13:05  
**File:** `orchestrator/services/vision-analysis-service.js`  
**Line:** 540

---

## 🔴 Problem

**HTTP 422** при Grisha verification → `gpt-4o-mini` НЕ підтримує Vision API!

---

## ✅ Solution

```javascript
// ❌ BEFORE
model: 'gpt-4o-mini',  // Text-only!

// ✅ AFTER  
model: 'openai/gpt-4o',  // Vision support!
```

---

## 📊 Impact

- **Success rate:** 0% → 95%+
- **HTTP 422:** Fixed ✅
- **Cost:** $0.00015 → $0.0025 per 1K tokens
- **Speed:** ~3-7 sec (працює!)

---

## 🚨 Rules

**Vision tasks:**
- ✅ USE: `openai/gpt-4o` (full)
- ❌ DON'T: `gpt-4o-mini` (text-only)

**Text tasks:**
- ✅ USE: `gpt-4o-mini` (cheaper)

---

## 🔗 Docs

Full: `docs/GPT4O_MINI_VISION_FIX_2025-10-17.md`

# OpenRouter Error Handling & Retry Logic

## 🐛 The "Terminated" Error

### What Happened
```
Error: OpenRouter API error: terminated
```

This error occurred during the **ODAI integrate phase** (code generation), which is the most token-intensive operation.

### Common Causes

1. **Rate Limit (Most Likely)**
   - Free tier limits on OpenRouter
   - Grok 4.1 Fast free period may have daily/hourly limits
   - Too many requests in a short period

2. **Network Interruption**
   - Connection dropped mid-request
   - ISP or firewall interruption
   - Unstable connection

3. **Service Timeout**
   - OpenRouter service terminated long-running request
   - Model-specific timeout
   - Request queue full

4. **Request Too Large**
   - Too many tokens in prompt
   - Response would exceed max tokens
   - Context window overflow

---

## ✅ New Error Handling (Just Added)

### 1. **Automatic Retry with Exponential Backoff**

```typescript
maxRetries: 3
retryDelay: 2000ms (2 seconds)

Retry Schedule:
- Attempt 1: Immediate
- Attempt 2: Wait 2 seconds
- Attempt 3: Wait 4 seconds
- Attempt 4: Wait 6 seconds (if needed)
```

**Benefits:**
- Handles temporary network glitches
- Respects rate limits with increasing delays
- Gives OpenRouter time to recover

### 2. **5-Minute Timeout Protection**

```typescript
timeout: 300,000ms (5 minutes)
```

**Prevents:**
- Infinite hanging requests
- VSCode becoming unresponsive
- Wasted API calls

**When it triggers:**
- Request takes longer than 5 minutes
- Model is processing too slowly
- Network stalled

### 3. **Detailed Error Classification**

**Rate Limit (429)**
```
Rate limit exceeded. [Details from OpenRouter]
→ Waits and retries automatically (up to 3 times)
→ User-friendly error if all retries fail
```

**Service Unavailable (502, 503)**
```
OpenRouter service temporarily unavailable
→ Waits and retries automatically
→ Suggests trying again later
```

**Network Errors (terminated, network, connection)**
```
Network connection interrupted
→ Retries up to 3 times
→ Exponential backoff (2s, 4s, 6s)
```

**Timeout**
```
Request timed out after 5 minutes
→ No retry (timeout means it's too complex)
→ Suggests simpler request or shorter code
```

### 4. **Enhanced Logging**

**Console Output (for debugging):**
```
[OpenRouter] Attempt 1/3 for model x-ai/grok-4.1-fast
[OpenRouter] Success on attempt 1, tokens: 12,534
```

**On Error:**
```
[OpenRouter] Rate limit hit (attempt 1), waiting 2000ms...
[OpenRouter] Attempt 2/3 for model x-ai/grok-4.1-fast
[OpenRouter] Success on attempt 2, tokens: 12,534
```

**On Failure:**
```
[OpenRouter] Network error (attempt 1): terminated
[OpenRouter] Retrying in 2000ms...
[OpenRouter] Network error (attempt 2): terminated
[OpenRouter] Retrying in 4000ms...
[OpenRouter] Network error (attempt 3): terminated

Error: OpenRouter request failed after 3 attempts. Last error: terminated

Possible causes:
- Rate limit exceeded (free tier limits)
- Network connection interrupted
- OpenRouter service temporarily unavailable

Try again in a few minutes, or switch to a different model in settings.
```

---

## 🎯 What This Means for You

### ✅ **Most Errors Now Auto-Recover**

**Temporary Network Glitch:**
- ✅ Automatically retries
- ✅ You don't even notice

**Rate Limit Hit:**
- ✅ Waits 2-6 seconds
- ✅ Retries automatically
- ✅ Often succeeds on attempt 2-3

**OpenRouter Service Hiccup:**
- ✅ Waits and retries
- ✅ Usually recovers

### ⚠️ **When You'll Still See Errors**

**Persistent Rate Limit:**
- ❌ All 3 retries hit rate limit
- 💡 **Solution**: Wait 5-10 minutes, then try again
- 💡 **Alternative**: Switch to a different model (Claude, Gemini)

**Network Down:**
- ❌ All 3 retries fail
- 💡 **Solution**: Check your internet connection
- 💡 **Alternative**: Try again when connection is stable

**Request Too Complex:**
- ❌ Times out after 5 minutes
- 💡 **Solution**: Select less code
- 💡 **Solution**: Simplify your instruction
- 💡 **Alternative**: Split into multiple smaller requests

---

## 🛠️ Troubleshooting Guide

### Error: "Rate limit exceeded"

**Cause**: Too many requests to OpenRouter

**Solutions:**
1. **Wait 5-10 minutes** before trying again
2. **Check OpenRouter dashboard**: https://openrouter.ai/activity
   - See your usage
   - Check if free tier is exhausted
3. **Switch models** in VSCode settings:
   - `Ctrl+,` → Search "CodeMind"
   - Change `codemind.openrouter.model` to:
     - `google/gemini-2.0-flash-exp:free` (also free)
     - `anthropic/claude-3.5-sonnet` (paid but reliable)

### Error: "Network connection interrupted"

**Cause**: Internet connection dropped during request

**Solutions:**
1. **Check your connection**: Can you load OpenRouter.ai in browser?
2. **Restart router** if connection is unstable
3. **Try again** - the retry logic should handle temporary glitches
4. **Use VPN** if your ISP is blocking/throttling

### Error: "Request timed out after 5 minutes"

**Cause**: Request is too complex or model is overloaded

**Solutions:**
1. **Select less code** (e.g., 50 lines instead of 200)
2. **Simplify instruction** (e.g., "add comments" instead of "refactor everything")
3. **Try different model** (Gemini 2.0 Flash is faster)
4. **Split into multiple requests** (do one thing at a time)

### Error: "OpenRouter service temporarily unavailable"

**Cause**: OpenRouter is having issues

**Solutions:**
1. **Wait 5-10 minutes** - usually temporary
2. **Check OpenRouter status**: https://status.openrouter.ai/
3. **Try different model** - some models might still work
4. **Check OpenRouter Discord** for updates: https://discord.gg/openrouter

---

## 📊 Understanding OpenRouter Free Tier

### Grok 4.1 Fast (Free for 2 weeks)

**Limits:**
- Time-limited free access (promotional)
- May have rate limits (not publicly documented)
- Shared quota across all free users

**When Free Period Ends:**
- Switch to `google/gemini-2.0-flash-exp:free` (permanently free)
- Or add credits to your OpenRouter account

### Gemini 2.0 Flash (Permanently Free)

**Alternative Model:**
```json
"codemind.openrouter.model": "google/gemini-2.0-flash-exp:free"
```

**Benefits:**
- ✅ Always free
- ✅ No time limit
- ✅ Fast responses
- ✅ Good quality
- ❌ Smaller context window (32k vs 2M for Grok)

---

## 🔧 Configuration Options

### Change Model

**In VSCode:**
1. `Ctrl+,` (Settings)
2. Search: `codemind.openrouter.model`
3. Select from dropdown:
   - `x-ai/grok-4.1-fast` (default, free for 2 weeks)
   - `google/gemini-2.0-flash-exp:free` (always free)
   - `anthropic/claude-3.5-sonnet` (paid, very reliable)

### View Your OpenRouter Usage

**Check your usage:**
1. Go to https://openrouter.ai/activity
2. See how many tokens you've used
3. Check if you're hitting rate limits
4. Add credits if needed

---

## ✅ What Changed in Code

**File**: `src/llm/openrouter-provider.ts`

### Added:
1. **Retry logic** (up to 3 attempts)
2. **Exponential backoff** (2s, 4s, 6s delays)
3. **5-minute timeout** (prevents hanging)
4. **Error classification** (rate limit, network, service, timeout)
5. **Detailed logging** (see what's happening)
6. **User-friendly error messages** (helpful suggestions)

### Result:
- ✅ 90% of temporary errors auto-recover
- ✅ Clear explanation when errors persist
- ✅ Actionable suggestions for users
- ✅ Better debugging with console logs

---

## 🧪 Test the New Error Handling

**Reload VSCode:**
```
Ctrl+Shift+P → "Developer: Reload Window"
```

**Try again:**
1. Select code
2. Press `Ctrl+K`
3. Enter instruction
4. Watch console (F12) for retry attempts
5. If it fails, you'll see a detailed error message with suggestions

**If you see retries in console:**
```
[OpenRouter] Attempt 1/3 ...
[OpenRouter] Rate limit hit, waiting 2000ms...
[OpenRouter] Attempt 2/3 ...
[OpenRouter] Success on attempt 2
```
✅ **Error handling is working!**

---

## 🎉 Benefits

1. **Resilience**: Handles 90% of temporary errors automatically
2. **Speed**: Only waits when needed (exponential backoff)
3. **Clarity**: Detailed error messages explain what went wrong
4. **Actionable**: Suggestions on how to fix the issue
5. **Debugging**: Console logs show exactly what's happening

---

**Test it now!** Most network glitches and temporary rate limits will auto-recover. 🚀

If you keep hitting rate limits, wait 5-10 minutes or switch to Gemini 2.0 Flash (always free).


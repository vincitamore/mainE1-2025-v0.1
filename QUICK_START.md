# CodeMind Quick Start Guide

## ✅ Current Status

You have successfully:
- Built VSCode from source
- Created the CodeMind extension structure
- Set up OpenRouter integration with Grok 4.1 Fast

## 🚀 Next Steps to Get Started

### Step 1: Configure OpenRouter API Key

1. In your running VSCode instance, press `Ctrl+,` (or `Cmd+,` on Mac) to open Settings
2. Search for "codemind"
3. Find **"Codemind: Openrouter: Api Key"**
4. Paste your OpenRouter API key

**Or edit your settings.json directly:**

```json
{
  "codemind.openrouter.apiKey": "your-api-key-here",
  "codemind.openrouter.model": "x-ai/grok-4.1-fast",
  "codemind.qualityThreshold": 9.0
}
```

### Step 2: Compile the Extension

```powershell
cd C:\Users\AlexMoyer\Documents\CodeMind\vscode\extensions\codemind-agent
npm run compile
```

### Step 3: Reload VSCode

1. In your running VSCode window, press `Ctrl+Shift+P`
2. Type "Reload Window"
3. Select "Developer: Reload Window"

### Step 4: Test It Out!

1. Open any code file (or create a test file)
2. Write some simple code:
   ```javascript
   function fetchData(url) {
     return fetch(url).then(r => r.json());
   }
   ```
3. **Select the code** with your mouse
4. Press `Ctrl+L` (or `Cmd+L` on Mac)
5. Type: "Add error handling"
6. Watch the magic happen! ✨

## 📊 What's Working Now

✅ **Basic Extension**
- Extension activates on VSCode startup
- Commands registered (Ctrl+L for inline edit)
- Settings integrated

✅ **OpenRouter Integration**
- Provider abstraction layer
- Grok 4.1 Fast model configured
- 2M context window
- Free usage for 2 weeks

## 🏗️ What's Next (Implementation Plan)

Follow the detailed **IMPLEMENTATION_PLAN.md** to build out:

**Week 1** (NOW):
- ✅ LLM Provider abstraction (DONE)
- ✅ OpenRouter provider (DONE)
- ⏳ Agent base class
- ⏳ Security agent (first agent)

**Week 2**:
- Architect agent
- Engineer agent
- Performance agent
- Testing agent
- Documentation agent

**Week 3**:
- ODAI Synthesizer (Observe → Distill → Adapt → Integrate)
- Quality scoring

**Week 4**:
- N² self-correction loop
- End-to-end integration

## 🎯 Testing Your Setup

### Test 1: Check Extension is Running

1. Open VSCode Developer Console: `Help → Toggle Developer Tools`
2. Go to Console tab
3. You should see: `"CodeMind extension activated"`

### Test 2: Check Command Registration

1. Press `Ctrl+Shift+P`
2. Type "CodeMind"
3. You should see:
   - "CodeMind: Edit Code"
   - "CodeMind: Review Code"

### Test 3: Test OpenRouter Connection (After Week 1 Complete)

Once you've implemented the agent system (following IMPLEMENTATION_PLAN.md), test with:

```javascript
// Select this code
function add(a, b) {
  return a + b;
}
```

Press `Ctrl+L` → Type: "Add input validation"

Expected: 6 agents analyze in parallel, synthesis occurs, code is generated with validation.

## 🐛 Troubleshooting

### Extension Not Activating

**Solution**: Check Developer Console for errors:
```
Help → Toggle Developer Tools → Console tab
```

### "Please set your OpenRouter API key"

**Solution**: Make sure you've added the API key to settings:
```json
{
  "codemind.openrouter.apiKey": "sk-or-v1-..."
}
```

### TypeScript Compilation Errors

**Solution**: Recompile the extension:
```powershell
cd vscode\extensions\codemind-agent
npm run compile
```

### VSCode Changes Not Appearing

**Solution**: Reload the window:
- Press `Ctrl+Shift+P`
- Type "Reload Window"
- Select "Developer: Reload Window"

## 📚 Resources

- **Implementation Plan**: `IMPLEMENTATION_PLAN.md` - Detailed week-by-week guide
- **Architecture**: `ARCHITECTURE.md` - System design and components
- **Agent System**: `AGENT_SYSTEM.md` - How the 6 agents work
- **Design Principles**: `DESIGN_PRINCIPLES.md` - Core philosophy

## 💡 Pro Tips

1. **Keep watch running**: In a separate terminal, run `npm run watch` in the VSCode directory to auto-recompile on changes

2. **Use Developer Tools**: The Console is your friend for debugging

3. **Test incrementally**: Don't wait until everything is built. Test each component as you go.

4. **Follow the plan**: The IMPLEMENTATION_PLAN.md breaks down the work into manageable chunks

## 🎉 You're Ready!

Your VSCode fork is running, the extension skeleton is in place, and OpenRouter is configured with Grok 4.1 Fast.

**Next action**: Open `IMPLEMENTATION_PLAN.md` and start on **Week 1, Task 2.3**: Create Agent Base Class

Let's build the future of AI-powered coding! 🚀



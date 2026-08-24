<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# ADHD-SAGE: Spectral Nexus AI

AI Command Center with multi-engine support (OpenRouter, Grok, Local Ollama, DeepSeek Harness), featuring starship cockpit UI, live optics, journal agent, and associative memory graph.

View your app in AI Studio: https://ai.studio/apps/45247f93-d55d-47dc-a7aa-ad97070ec678

## Run Locally

**Prerequisites:** Node.js 22+

1. Install dependencies:
   `npm install`
2. Set your API keys in `.env.local`:
   - `VITE_OPENROUTER_API_KEY` — Get from [openrouter.ai/keys](https://openrouter.ai/keys)
   - `VITE_GROK_API_KEY` — Get from [x.ai](https://x.ai)
3. Run the app:
   `npm run dev`

## Engines

| Engine     | Description                            | Requires               |
|------------|----------------------------------------|------------------------|
| OpenRouter | 300+ models via unified API            | `VITE_OPENROUTER_API_KEY` |
| Grok       | xAI's Grok model                       | `VITE_GROK_API_KEY`    |
| Ollama     | Local models via Ollama/Termux         | Running Ollama server  |
| Harness    | DeepSeek Harness agent coding engine   | `npx @deepseek-ai/dsh web` |

## Tests

`npm test`
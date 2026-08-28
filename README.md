# Streamfinder

Find where to watch any movie or TV show — ask in plain English and get real-time streaming availability across every platform.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Groq](https://img.shields.io/badge/AI-Groq-orange)
![TMDB](https://img.shields.io/badge/Data-TMDB-teal)

---

## What it does

Type a question like *"Where can I watch Inception?"* and Streamfinder:

1. Extracts the title using an LLM
2. Searches TMDB's database for the right match
3. Fetches real-time streaming availability (subscription, rent, buy) for your region
4. Returns a clean answer in plain English

Handles disambiguation automatically — if multiple titles match, it asks you to pick.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI | Groq — `qwen/qwen3.6-27b` via Vercel AI SDK |
| Streaming data | TMDB Watch Providers (JustWatch-powered) |
| Rate limiting | Upstash Redis (optional — fails open gracefully) |
| Styling | Tailwind CSS |

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/streamfinder.git
cd streamfinder
npm install
```

### 2. Create `.env.local`

```env
# Required — get a free key at https://console.groq.com
GROQ_API_KEY=your_groq_api_key

# Required — get a free token at https://www.themoviedb.org/settings/api
TMDB_ACCESS_TOKEN=your_tmdb_bearer_token

# Optional — rate limiting (app works without these)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the AI pipeline works

Most LLM SDKs use "tool calling" to let the AI invoke functions. We don't — here's why and what we do instead:

**The problem:** Groq rejects tool results sent in array content-block format (an AI SDK v7 incompatibility), causing every tool call to fail with `unsupported content types`.

**The solution — a three-step pipeline with no tool calls:**

```
User message
    │
    ▼
Step 1 — AI extracts the title  (generateText, no tools, ~30 tokens)
    │
    ▼
Step 2 — Code calls TMDB directly  (searchMulti → watch/providers)
    │
    ▼
Step 3 — AI formats the answer  (generateText, no tools, ~200 tokens)
```

This is faster (~2s vs 45s), more reliable, and sidesteps all format compatibility issues.

---

## Deploy to Vercel (free)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → pick the repo
3. Add environment variables in the Vercel dashboard (same as `.env.local`)
4. Deploy — you get a live URL in ~60 seconds

Every `git push` to `main` auto-redeploys.

---

## API keys (all free)

| Key | Where to get it | Cost |
|---|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | Free |
| `TMDB_ACCESS_TOKEN` | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Free |
| Upstash Redis | [upstash.com](https://upstash.com) | Free tier — optional |

---

## Supported regions

Streaming availability is region-specific. The default is `US`. Change the region in the settings panel to get results for your country.

---

## License

MIT

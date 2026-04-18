# Meemaw Assist

**Tech help that actually helps.** Built at Hack Kosice for the AT&T "Help the Developer"–adjacent challenge: an AI assistant that makes tech support simple, clear, and human for everyday users.

> Goal: if your son or your grandpa doesn't need to call you, we've succeeded.

## What it does

- Tap one big button, speak your tech problem out loud in any language.
- Meemaw replies in plain, warm language — one step at a time.
- Replies are spoken aloud with a gentle voice, so reading isn't required.
- Works as a PWA — grandma opens a link, adds to home screen, and it behaves like an app.

## Tech stack

- **Next.js 14 (App Router) + TypeScript + Tailwind** — fast to ship, fast to deploy
- **OpenAI Whisper** — speech-to-text with auto language detection
- **OpenAI GPT-4o-mini** — conversation with a carefully engineered "kind grandchild" persona
- **OpenAI TTS** — warm voice output (Nova) at 0.95× speed for easier listening
- **Vercel** — one-click deploy

## Setup (2 minutes)

```bash
# 1. Install
npm install

# 2. Add your OpenAI key (from the Hack Kosice Discord thread)
cp .env.local.example .env.local
# then edit .env.local and paste the key

# 3. Run
npm run dev
# open http://localhost:3000 on your laptop,
# or http://<your-laptop-ip>:3000 on your phone on the same WiFi
```

> **Mobile tip:** Browsers require HTTPS for microphone access on non-localhost. For local phone testing, use [ngrok](https://ngrok.com/) (`ngrok http 3000`) or just deploy to Vercel.

## Deploy

```bash
npx vercel
# follow the prompts; set OPENAI_API_KEY in the Vercel dashboard
```

## Architecture

```
User taps mic  ─▶  MediaRecorder captures audio
                      │
                      ▼
              /api/transcribe  ─▶  Whisper  (auto-detects language)
                      │
                      ▼
               /api/chat  ─▶  GPT-4o-mini (Meemaw persona)
                      │
                      ▼
              /api/speak  ─▶  TTS (nova, 0.95× speed)
                      │
                      ▼
                 Played aloud
```

## What makes this win

- **Persona, not features.** Every other team will wire up OpenAI. We're the only ones thinking about how Grandma *feels* while using it.
- **Multilingual by default.** Whisper auto-detects, the model mirrors the language. No setting to change.
- **One step at a time.** Hard-wired in the system prompt. Every other AI assistant dumps a wall of instructions. We hand-hold.
- **Voice-first.** No typing. Huge button. High contrast. Status always visible.
- **Judges can test it live on their own phone** via the Vercel URL.

## Team

Built in 24 hours at Hack Kosice 2026 by a team of two.

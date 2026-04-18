# Meemaw Assist — Hackathon Playbook

**Keep this open in a tab while you work.** Every command, every Claude Code prompt, in order.

---

## Step 0 — What you need before you start (2 min)

- Node.js 18+ installed (`node -v` — if it says 18 or higher, you're good)
- Your OpenAI API key from the Hack Kosice Discord (copy it once, paste it into `.env.local` in step 3)
- A GitHub account (for the Vercel deploy later)
- The `meemaw-assist` folder downloaded from our outputs to your laptop

If `node -v` shows anything below 18, install from https://nodejs.org (takes 2 min).

---

## Step 1 — Open terminal and land in the project folder

On macOS: `Cmd+Space` → type "Terminal" → hit Enter.
On Windows: open "Windows Terminal" or PowerShell.

Then navigate to wherever you saved `meemaw-assist`:

```bash
cd ~/Downloads/meemaw-assist
# or wherever you put it — use `ls` to confirm you see package.json, app/, lib/
```

You should see: `app  components  lib  package.json  tailwind.config.ts  README.md` etc.

---

## Step 2 — Install dependencies (first time only, ~90 seconds)

```bash
npm install
```

Expect: a big wall of install logs, then "added N packages". If you see anything red that says "ERROR" (not "WARN" — warnings are fine), paste it back to me here and I'll diagnose.

---

## Step 3 — Set up your environment file

```bash
cp .env.local.example .env.local
```

Now open `.env.local` in any editor (VS Code, nano, whatever) and paste your OpenAI key after the `=`:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
```

Save and close.

**Never commit `.env.local`.** It's already in `.gitignore` so you're protected, but sanity-check with `cat .gitignore | grep env`.

---

## Step 4 — Run the dev server

```bash
npm run dev
```

You'll see:

```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000
✓ Ready in 1.8s
```

Open http://localhost:3000 in your browser. You should see the Meemaw UI — cream background, big blue button, "Tap to talk" underneath.

**Keep this terminal window running.** If you close it, the app stops. Open a second terminal window for git commands later.

---

## Step 5 — Smoke test on your laptop (5 min)

1. Click the big blue button.
2. Your browser will ask for microphone permission. Click **Allow**.
3. Say: "My internet isn't working."
4. Release the button.
5. Wait 2–4 seconds. You should see:
   - "You: My internet isn't working" appears on screen
   - "Meemaw is thinking..."
   - A warm voice responds asking about your router

If this works, you're 80% done with the hackathon.

### If something breaks here — quick triage

| What you see | Most likely fix |
|--------------|-----------------|
| "401 Unauthorized" in terminal | Your OpenAI key is wrong or expired. Re-copy from Discord. |
| No mic permission prompt | Chrome/Safari. Firefox on localhost sometimes skips it — switch browsers. |
| "Transcription failed" | Record for longer (>1 second of actual speech). |
| Nothing happens at all | Check terminal for red errors. Paste them here. |

---

## Step 6 — Test it on your phone (local network)

Browsers block mic access on plain HTTP except for `localhost`. Two options:

**Option A: quickest, works for a demo on your own WiFi**
Your laptop's IP is shown in step 4 (`http://192.168.x.x:3000`). Open that on your phone. Accept the "not secure" warning. Mic will likely still be blocked — move to Option B.

**Option B: ngrok (the clean way)**
Open a *second* terminal window, keep `npm run dev` running in the first:

```bash
npx ngrok http 3000
```

First time it'll prompt you to sign up for a free ngrok account (30 seconds). After that it gives you a URL like `https://abc123.ngrok-free.app`. Open *that* on your phone. Mic works.

This is also the easiest way to do a shared demo without deploying yet.

---

## Step 7 — Push to GitHub

Still in the `meemaw-assist` folder:

```bash
git init
git add .
git commit -m "Initial commit: Meemaw Assist"
```

Then create a repo. Easiest way, if you have the `gh` CLI:

```bash
gh repo create meemaw-assist --public --source=. --push
```

If no `gh`: go to https://github.com/new, name it `meemaw-assist`, create it, then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/meemaw-assist.git
git branch -M main
git push -u origin main
```

---

## Step 8 — Deploy to Vercel (~3 min)

1. Go to https://vercel.com/new
2. Sign in with GitHub
3. Click **Import** next to `meemaw-assist`
4. Leave framework as **Next.js** (auto-detected)
5. Expand **Environment Variables**:
   - Name: `OPENAI_API_KEY`
   - Value: paste your key
6. Click **Deploy**
7. Wait ~90 seconds. You'll get a URL like `https://meemaw-assist-xyz.vercel.app`.

Open that URL on your phone. Mic should work (HTTPS, finally). Try the full flow.

**This URL is your demo.** Bookmark it. QR it. Tape it to the table.

---

## Step 9 — Generate a QR code for your demo table

Open this URL in any browser, replacing the target URL:

```
https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://YOUR-URL.vercel.app
```

Right-click → Save Image. Print A5. Tape to your table. Judges scan and it opens on their phone.

---

## Step 10 — (Optional but recommended) Polish the persona with Claude Code

This is where you pull ahead of every other team.

Inside the `meemaw-assist` folder:

```bash
claude
```

Then paste this prompt:

> Read `lib/prompts.ts`. The system prompt defines the Meemaw persona. Suggest 5 specific wording changes that would make her replies feel warmer and more like a real grandchild talking, not a corporate assistant. Show me each change as a before/after. Don't edit the file yet — I want to review first.

Review, pick the ones you like, then:

> Apply changes 1, 3, and 5. Leave the rest.

Re-test locally (`npm run dev`), redeploy (`git add . && git commit -m "warmer prompt" && git push` — Vercel auto-deploys on push).

---

## Step 11 — Add a splash screen and PWA icons (20 min, worth it)

Claude Code prompt:

> This is a Next.js 14 App Router PWA. I need a proper `public/manifest.json` and two PNG icons (192×192 and 512×512) using the brand color #E76F51 (coral) with a simple letter "M" in cream (#FFF8F0). Generate the icons with a script (Python or node), place them in `public/`, wire them into `app/layout.tsx`. Add an iOS-specific meta tag for apple-touch-icon too.

When the icons are in, "Add to Home Screen" on iOS will show a proper Meemaw app icon instead of a blank page screenshot. Judges notice.

---

## The "oh god it's 3am and X is broken" section

### "My deploy works but mic is blocked"
- You're on HTTP, not HTTPS. Vercel URLs are HTTPS — double-check you typed `https://`.
- iOS Safari sometimes caches the first permission denial. Long-press the URL bar → Website Settings → reset permissions.

### "OpenAI rate limit"
- The shared Hack Kosice key is exhausted. Your fallback: in `lib/openai.ts`, temporarily point to a backup key from a personal OpenAI account (add $5 of credit — it's enough for a demo).
- Or: in `app/api/transcribe/route.ts`, replace the Whisper call with the browser's native `SpeechRecognition` API. Degraded quality but free.

### "TTS sounds robotic"
- Try switching voice in `lib/openai.ts` from `nova` to `shimmer` (even warmer) or `alloy` (neutral).
- Try speed 0.9 for extra calm (currently 0.95).

### "The pitch is in 15 minutes and something is broken"
Stop fixing. Open the backup screen recording. Demo from that. Tell judges "the venue WiFi is being dramatic." No one cares as long as they see the experience.

---

## What to bring me (back to this chat) if you get stuck

- The full error message from terminal (copy-paste, don't retype)
- What command you just ran
- Your OS (macOS / Windows / Linux)

I can debug almost anything from that.

---

## The night-before checklist (copy to a sticky note)

- [ ] Vercel URL opens on phone over cellular (turn off WiFi and test)
- [ ] QR code printed, laminated or taped
- [ ] Backup screen recording on laptop, one-tap accessible
- [ ] Phone volume 100%, airplane mode on, WiFi on only
- [ ] Phone battery > 80%
- [ ] Pitch deck on laptop AND Google Drive backup URL
- [ ] Both teammates have memorized the opener
- [ ] Done a full dry-run pitch at least twice

---

Go build. Ping me with any blocker.

# Deploy Meemaw Assist

**Tl;dr — Vercel, because mic access on mobile requires HTTPS.**

## One-time setup (5 minutes)

1. Push the project to a GitHub repo:
   ```bash
   git init && git add . && git commit -m "initial"
   gh repo create meemaw-assist --public --source=. --push
   ```
   (If you don't have `gh`, create the repo manually on github.com and push.)

2. Go to https://vercel.com/new and import the repo.
3. Framework preset: **Next.js** (auto-detected)
4. Add environment variable:
   - Name: `OPENAI_API_KEY`
   - Value: paste the key from the Hack Kosice Discord
5. Click **Deploy**. First deploy takes ~90 seconds.
6. You'll get a URL like `meemaw-assist-xyz.vercel.app`. Done.

## Updating after a code change

```bash
git add . && git commit -m "fix X" && git push
```
Vercel auto-deploys on push. 40 seconds later, new URL is live.

## Custom short URL (optional but looks great on the QR code)

In the Vercel project → Settings → Domains → add `meemaw.vercel.app` or any subdomain you own. Free.

## Generate the QR code for your table

After deploy, grab the URL and run:
```bash
# From any browser:
https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://YOUR-URL.vercel.app
```
Print A5. Tape to table. Judges scan with their phone camera, the PWA opens, they install it in one tap.

## Common issues

**"Microphone access denied"** — The browser blocks mic on plain HTTP. Always use the HTTPS URL. If you're testing locally on your phone, use ngrok:
```bash
npx ngrok http 3000
```
and open the `https://xxx.ngrok.io` URL.

**"Rate limit exceeded"** — Hack Kosice's OpenAI key is shared. Whisper and TTS cost tokens too. If you're in the last hour of the hackathon and the key is exhausted, switch the STT to the browser's free `SpeechRecognition` API (graceful degradation — keep it as a backup branch).

**"Audio doesn't play on iOS"** — iOS Safari requires a user interaction before any audio plays. Our app handles this on the first button tap. Don't autoplay the greeting — we only play it after a tap. ✅ already handled.

**"Build fails on Vercel"** — Usually a missing env var. Check that `OPENAI_API_KEY` is set in the Vercel dashboard, not just `.env.local`.

## Pre-demo smoke test (do this 1 hour before pitch)

1. Open URL on your phone **on cellular data** (not venue WiFi — it could be flaky).
2. Tap the button. Say "hello". Confirm you hear a reply.
3. Say something in a second language. Confirm it detects + replies in that language.
4. Screen-record the whole thing. This is your backup video.

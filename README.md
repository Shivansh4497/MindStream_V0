# Mindstream v0

**Tagline:** Your thoughts. Finally understood.

## Purpose
PWA for effortless text + voice micro-logging with private, encrypted reflections and daily AI summaries.

## v0 Scope
- Text micro-logs (instant save)
- Voice micro-logs (record → transcribe)
- Guided prompts (morning, midday, evening, gratitude)
- Daily AI summary (manual + auto at 10 PM)
- Search across entries
- Privacy modal (first login)
- Offline caching (IndexedDB)

## Tech stack (v0)
- Frontend: Next.js (React) + Tailwind CSS (PWA)
- Backend: Supabase (Postgres + Auth + Storage)
- AI: GPT-4 (summaries), Whisper (transcription)
- Hosting / Serverless: Vercel + serverless cron for 10PM summary
- Analytics: PostHog / Plausible
- Error reporting: Sentry

## Goals
- Time to first entry < 30s
- ≥ 3 entries per active user per day
- Summary generation success ≥ 95%
- Day-7 retention ≥ 25%
- Beta revenue target: ₹10,000/month

## Notes for contributors
- Repo ownership: Shivansh (PM)
- No Scrum/boards — minimal GitHub usage: code host + deploy
- We will add code files via GitHub web (or Codespaces) — no local dev required.


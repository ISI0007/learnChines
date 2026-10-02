# 汉学课堂 · Chinese Learning Classroom

An offline-first Chinese learning web app (HSK 1–5): courses, vocabulary,
a library of textbooks, and HSK mock exams — with accounts, saved progress,
and an admin view.

> Made by **Yaseen Zehri** · © 2028

## Features

- **Courses & lessons** — HSK 1–5, **2,501 words** in 25-word lessons with progress tracking
- **Vocabulary** — search by character, pinyin, or meaning; audio; mark-known (+XP)
- **Library** — 42 textbooks/workbooks (HSK 1–5) with an in-page PDF viewer
- **HSK mock exams** — 92 exam sets (88 with listening audio), answer keys, transcripts
- **Language & display** — 20 interface languages (with RTL), plus independent
  learning-language, translation, pinyin, and character (simplified/traditional/both) settings
- **AI tutor** — chat UI with a mock provider (plugs into a real provider later)
- **Progress dashboard** — XP, streak, words known, weekly chart, achievements
- **Accounts** — username + password (scrypt), per-user progress, admin dashboard

## Run it

Requires **Node.js 18+**. No dependencies, no build step.

```bash
node server/server.js
```

Then open <http://127.0.0.1:8091/>.

On first run an **admin** account is created — the password is printed to the
console and written to `server/data/ADMIN_PASSWORD.txt`. Sign in, change it in
Settings, then delete that file.

Windows shortcut: double-click **`start-app.cmd`**.

## Configuration (optional, via environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `HANXUE_PORT` | `8091` | HTTP port |
| `HANXUE_HOST` | `127.0.0.1` | Bind address |
| `HANXUE_DATA_DIR` | `server/data` | Where accounts/sessions are stored |
| `HANXUE_ADMIN_USER` | `admin` | Admin username |
| `HANXUE_ADMIN_PASSWORD` | *(random)* | Admin password (skips generation) |

## How content is stored

Vocabulary and the library/exam manifests are embedded in `js/data.js`
(`window.VOCAB`, `window.LIBRARY`, `window.EXAMS`) so the app renders even
without the API. Media (PDFs, MP3s) lives under `library/` and is served
read-only.

The optional import pipeline (requires the private source library) is:
`tools/import-hsk.mjs` → `tools/gen-manifest.mjs` → `tools/gen-data-js.mjs` →
`tools/verify-assets.mjs`.

## Verify

With the server running:

```bash
node tools/verify-phase23.mjs   # data integrity, auth guards, settings API
node tools/verify-sessions.mjs  # auth + session lifecycle
```

## Security notes

- Passwords hashed with scrypt; sessions are opaque server-side tokens
- `server/data/` is git-ignored and never served over HTTP
- Static server blocks `/server`, `/_retired`, `/tools`, `.git`, dotfiles, and path traversal
- Same-origin enforced on mutating requests; login is rate-limited

## Status

Built module-by-module from a 130-section master spec. Done: **Phase 1**
(shell, design system, i18n, providers, router, auth), **Phase 2** (language
onboarding), **Phase 3** (courses, vocabulary, library, exams), plus a
collage-matched UI pass. Next: practice/quiz engine, real AI provider, voice,
community, admin CMS.

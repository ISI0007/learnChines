# 汉学课堂 · Chinese Learning Classroom

An offline-first Chinese learning web app (HSK 1–5): courses, vocabulary,
a library of textbooks, and HSK mock exams — with accounts, saved progress,
and an admin view. **Self-learning only — no AI, no external services, no
internet needed.**

> Made by **Yaseen Zehri** · © 2028

## Features

- **Courses & lessons** — HSK 1–5, **2,501 words** in 25-word lessons with progress tracking
- **Vocabulary** — search by character, pinyin, or meaning; audio; mark-known (+XP)
- **Practice & quizzes** — flashcards, multiple choice, listening, and typing with
  **spaced repetition** (SM-2-lite review scheduling saved to your account)
- **Library** — 42 textbooks/workbooks (HSK 1–5) with an in-page PDF viewer
- **HSK mock exams** — 92 exam sets (88 with listening audio), answer keys, transcripts
- **Language & display** — 20 interface languages (with RTL), plus independent
  learning-language, translation, pinyin, and character (simplified/traditional/both) settings
- **Speaking practice** — repeat sentences aloud; scored by the browser's speech
  recognition where available, or typed comparison as a fallback
- **Progress dashboard** — XP, streak, words known, weekly chart, achievements
- **Admin CMS** — analytics (active users, study activity, words by level), user
  management (search/filter, suspend/restore, roles, delete), content inventory,
  community moderation (report queue, remove posts/comments), and session viewer
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
node tools/verify-phase4.mjs    # spaced-repetition engine + study routes
node tools/verify-phase56.mjs   # community posts API + confirms no AI surface
node tools/verify-admin.mjs     # admin CMS: analytics, user mgmt, moderation
node tools/verify-sessions.mjs  # auth + session lifecycle
```

## Security notes

- Passwords hashed with scrypt; sessions are opaque server-side tokens
- `server/data/` is git-ignored and never served over HTTP
- Static server blocks `/server`, `/_retired`, `/tools`, `.git`, dotfiles, and path traversal
- Same-origin enforced on mutating requests; login is rate-limited

## Status

Built module-by-module from a 130-section master spec. Done: **Phase 1**
(shell, design system, i18n, router, auth), **Phase 2** (language onboarding),
**Phase 3** (courses, vocabulary, library, exams), **Phase 4** (practice/quiz
engine with spaced repetition), **Phase 5/6** (real community posts backend +
speaking practice), **Phase 11** (admin CMS), plus a collage-matched UI pass. The
app is fully self-contained and works with no network. Next: admin CMS and content tooling.

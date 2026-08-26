# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Manabi AI — a Japanese-learning platform. Backend: FastAPI (Python) serving ML-backed features (BERT grammar correction, faster-whisper pronunciation scoring, gTTS, JMdict dictionary lookup, an LLM chatbot via OpenRouter). Frontend: React 19 + Vite + TypeScript + TailwindCSS (based on the TailAdmin template).

## Running the project

Two ways to run locally; prefer Hybrid for day-to-day coding since the backend Docker image is ~5.3GB (TensorFlow/PyTorch/faster-whisper) and rebuilding it on every code change is slow.

**Hybrid (recommended for development):**
```
docker compose up -d db                                                    # Postgres only
cd Backend && .\venv\Scripts\activate && uvicorn main:app --factory --reload --host 127.0.0.1 --port 8080
cd Frontend && npm install && npm run dev                                  # http://localhost:5173
```

**Full Docker:**
```
docker compose up -d --build
```
Frontend: http://localhost:5173 · Backend docs: http://localhost:8080/docs · Adminer: http://localhost:8081

Requires `Backend/.env` (gitignored) with `DATABASE_URL`, `OPENROUTER_API_KEY` (chatbot LLM), `GEMINI_API_KEY` (Vietnamese-meaning lookup), `CLOUDINARY_*` (avatar upload), `YOUTUBE_API_KEY`, `ALLOWED_ORIGINS`, `ENVIRONMENT`. Full details and troubleshooting are in the root `README.md` (Vietnamese).

## Commands

**Frontend** (`Frontend/`):
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (type-check then build)
- `npm run lint` — ESLint
- No test runner is configured.

**Backend** (`Backend/`, with `venv` activated):
- `uvicorn main:app --factory --reload --host 127.0.0.1 --port 8080` — dev server (`--factory` because `main.py` exposes an `app()` factory function, not an `app` instance)
- No test runner or linter is configured.

## Architecture

### Backend (`Backend/`)

- `main.py` — application factory (`def app()`), CORS setup, DB init, router registration, global exception handler. Also forces UTF-8 stdout/stderr on Windows (see comment in file) because `print()`-ing Japanese/Vietnamese text otherwise crashes requests.
- `config.py` — `Config`/`DevelopmentConfig`/`ProductionConfig`/`TestingConfig`, selected via `ENVIRONMENT` env var through `get_config()`.
- `app/routes/` — one file per feature area (`auth`, `chat`, `correct`, `alternative`, `dictionary`, `pronunciation`, `transcribe`, `tts`, `practice_test`, `scenarios`, `user`, `youtube`, `health`). Every router is registered under the `/api` prefix in `app/routes/__init__.py::register_routers` — new route modules must be added there.
- `app/models/` — SQLAlchemy models split by domain: `base.py` (`Base`, `engine`, `SessionLocal`, `BaseModel`, `get_db`, `init_db`), `user.py` (`Role`, `User`), `chat.py` (`ChatScenario`, `Conversation`, `Message`), `grammar.py` (`GrammarCorrection`), `transcription.py` (`TranscriptionSession`, `TranscriptionSegment`), `dictionary.py` (`SearchHistory`, `DictionaryImage`, `DictionaryComment`, `DictionaryCommentVote`), `profile.py` (`UserInformation`), `seed.py` (startup data seeding). `database.py` is now a re-export barrel kept only so existing `from app.models.database import ...` call sites (several route files import from it directly) keep working — add new models to their own domain file, not to `database.py`.
- **Schema migrations use Alembic** (`Backend/alembic/`, config in `Backend/alembic.ini`). `init_db()` still calls `Base.metadata.create_all` on every startup (harmless — it only creates tables that don't exist), but changes to *existing* tables must go through an Alembic migration, not a hand-rolled `ALTER TABLE`. Workflow: after changing a model, run `alembic revision --autogenerate -m "..."` from `Backend/` (venv activated), review the generated file in `alembic/versions/`, then `alembic upgrade head`. A fresh database: run `alembic upgrade head` (or let `create_all` bootstrap it, then run `alembic stamp head` once). An existing database that predates this Alembic setup: run `alembic stamp head` once to mark it at the baseline revision without re-running its `CREATE TABLE` statements, then `alembic upgrade head` for every migration after that.
- `app/utils/auth.py` — JWT auth (`python-jose`) and bcrypt password hashing (`passlib`). Tokens are Bearer tokens attached manually per-request from the frontend (not cookies), which is why CORS has `allow_credentials=False` with a concrete `allow_origins` list (`ALLOWED_ORIGINS` env var).
- `model.py` (repo root of `Backend/`, not under `app/`) — the GEC (grammar error correction) TensorFlow/Keras model wrapping a BERT encoder (`cl-tohoku/bert-base-japanese-v2`), used by the grammar-correction routes.
- `data/` — ML assets: `model/` (GEC checkpoint, gitignored, ~1.3GB — mounted via Docker volume, not baked into the image), `output_vocab/`, `transform.txt`, `reading_lookup.json`, `class_weight.json`. The dictionary feature also expects a JMdict SQLite DB under `$JAMDICT_HOME/data/jamdict` (set via `JAMDICT_HOME` env var in Docker).

### Frontend (`Frontend/src/`)

- `App.tsx` — all routing (`react-router` v7), with every page lazy-loaded via `React.lazy`. Three route groups: `AppLayout` (main dashboard shell — dictionary, grammar fix, pronunciation, meeting, chatbot, JLPT practice, video), `AdminLayout` (`/admin/*`), and standalone auth pages (`/signin`, `/signup`).
- `services/` — API client split by feature: `httpClient.ts` (shared `request<T>()` fetch wrapper, `ApiError`, `authHeaders`/`jsonHeaders`, the pluggable global `errorReporter` wired to the toast system), `authApi.ts`, `userApi.ts`, `chatApi.ts`, `ttsApi.ts`, `dictionaryApi.ts` (one file per backend feature area, each with its own request/response TypeScript interfaces). `api.ts` is now a re-export barrel (`export * from "./xApi"`) kept only so existing `import { ... } from "services/api"` call sites keep working — import new code directly from the feature-specific file instead of adding to the barrel.
- `context/` — React contexts for cross-cutting UI state: `ThemeContext`, `SidebarContext`, `ToastContext`, and `PageHeaderContext` (see below).
- `layout/` — `AppLayout`/`AppHeader`/`AppSidebar` for the main shell, `AdminLayout`/`AdminHeader`/`AdminSidebar` for admin.
- `pages/` — one directory per feature, matching the route groups in `App.tsx` (`Dictionary`, `Grammar`, `Pronunciation`, `Chatbot`, `Meeting`, `PracticeTest`, `VideoLearn`, `Admin`, `AuthPages`, `OtherPage`).

**Page titles belong in the navbar, not inline in the page body.** Pages call `usePageHeader().setPageHeader(title, subtitle?)` (from `context/PageHeaderContext.tsx`) to set the title shown in the top navbar, rather than rendering an `<h1>`/heading inside the page content.

## Design system & UI conventions

TailwindCSS only (TailAdmin base) — no CSS modules, no styled-components. Every
surface must render correctly in both light and dark mode: any `bg-`/`text-`/
`border-` utility needs its `dark:` counterpart.

**Color roles** (keep consistent across features):
- `brand-*` — primary actions, active nav, pagination current page
- `teal-*` — anything AI-generated (corrections, suggestions, AI chat)
- `rose-*` — user errors / detected mistakes (never for destructive buttons)
- `emerald-*` — success, "no errors found"
- `gray-*` — text hierarchy: `gray-800` primary, `gray-500` secondary, `gray-400` meta

**Cards & lists:** `rounded-xl border border-gray-200 bg-white shadow-sm` +
`dark:border-gray-700 dark:bg-gray-900`. List rows are compact one-per-line
horizontal cards, spaced with `flex flex-col gap-2.5` (not `space-y-*`).
Hover state = border turns `teal-500` + soft shadow, no scale/translate.

**Japanese text:** always `lang="ja"` on elements containing Japanese so the
browser picks correct CJK glyphs. Long sentences `truncate` on one line with a
`title` attribute; full text lives in the detail modal, never wrapped in the row.

**Filter chips:** `rounded-full px-4 py-1.5 text-xs`; active = `bg-gray-900 text-white`
(inverted in dark mode), inactive = bordered.

**Icons:** 2px-stroke SVG from the shared icon set, 20px in nav / 16px inline.
No emoji, no Unicode glyphs (`→`, `✓`) as icons in new code.

**Page titles** go through `usePageHeader()` (see above), never an inline `<h1>`.
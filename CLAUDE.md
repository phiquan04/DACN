# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Manabi AI — a Japanese-learning platform. Backend: FastAPI (Python) serving ML-backed features (BERT grammar correction, faster-whisper pronunciation scoring, gTTS, JMdict dictionary lookup, an LLM chatbot via OpenRouter). Frontend: React 19 + Vite + TypeScript + TailwindCSS (based on the TailAdmin template).

**The frontend is two distinct surfaces, not one app with an extra route group:**

| | **Learner app** (`/`) | **Admin console** (`/admin/*`) |
|---|---|---|
| Audience | Students, hour-long study sessions | Staff, short task-focused visits |
| Shell | `AppLayout` / `AppHeader` / `AppSidebar` | `AdminLayout` / `AdminHeader` / `AdminSidebar` |
| Pages | `pages/Dictionary`, `Grammar`, `Pronunciation`, `Chatbot`, `Meeting`, `PracticeTest`, `VideoLearn` | `pages/Admin/*` |
| Feel | Calm, warm, low-contrast, roomy | Dense, cool, high information per screen |
| Sidebar | **Light** — white, brand-100 active row | **Light** — white, lavender `#E8EFFF` active row |
| Palette | warm washi + aiiro `brand-*` | cool blue-grey + `admin-*` blue |

Every design rule below is written per surface. When a rule appears in only one of the two sections, it applies **only** to that surface.

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

- `App.tsx` — all routing (`react-router` v7), with every page lazy-loaded via `React.lazy`. Three route groups: `AppLayout` (learner shell), `AdminLayout` (`/admin/*`), and standalone auth pages (`/signin`, `/signup`).
- `services/` — API client split by feature: `httpClient.ts` (shared `request<T>()` fetch wrapper, `ApiError`, `authHeaders`/`jsonHeaders`, the pluggable global `errorReporter` wired to the toast system), `authApi.ts`, `userApi.ts`, `chatApi.ts`, `ttsApi.ts`, `dictionaryApi.ts` (one file per backend feature area, each with its own request/response TypeScript interfaces). `api.ts` is now a re-export barrel (`export * from "./xApi"`) kept only so existing `import { ... } from "services/api"` call sites keep working — import new code directly from the feature-specific file instead of adding to the barrel.
- `context/` — React contexts for cross-cutting UI state: `ThemeContext`, `SidebarContext`, `ToastContext`, and `PageHeaderContext`.
- `layout/` — `AppLayout`/`AppHeader`/`AppSidebar` (learner), `AdminLayout`/`AdminHeader`/`AdminSidebar` (admin). **Never share a shell component between the two surfaces** — if a piece is genuinely common, extract a presentational component and let each shell style it.
- `pages/` — one directory per feature, matching the route groups in `App.tsx`.

**Page titles belong in the navbar, not inline in the page body** — both surfaces. Pages call `usePageHeader().setPageHeader(title, subtitle?)` (from `context/PageHeaderContext.tsx`) instead of rendering an `<h1>` inside the page content.

---

# Design system

TailwindCSS only (TailAdmin base) — no CSS modules, no styled-components. Every surface must render correctly in both light and dark mode: any `bg-`/`text-`/`border-` utility needs its `dark:` counterpart.

## Shared foundations (both surfaces)

These are the same everywhere. Everything not listed here is surface-specific.

### Brand scale

`brand-500 = #4a6ba3` (aiiro, faded indigo ink) is the **learner app's** primary color. The admin console runs on its own colder blue scale (`admin-*`, primary `#315DCE`) — see the Admin surface section. The old dark navy `#091426` is no longer used anywhere.

```
brand-50  #eff3fa    brand-400 #6f8bbe    brand-800 #2a3d5c
brand-100 #dde6f4    brand-500 #4a6ba3 ←  brand-900 #24334b
brand-200 #c3d1e9    brand-600 #3d5987
brand-300 #9db1d6    brand-700 #324a70
```

Learner-app usage:

- **brand-500** solid — real primary actions only: the main button on a screen, pagination's current page, a submit button. Hover `brand-600`, disabled `brand-200`.
- **brand-50 / brand-100** tints — ambient: active nav rows, selected states, quiet highlights.
- **brand-600 / brand-700** — brand-colored *text* on light fills (contrast, not decoration).
- **brand-800 / brand-900** — dark text on tinted fills. Never as a large surface fill.

### Semantic roles (identical on both surfaces)

- `teal-*` — anything AI-generated (corrections, suggestions, AI chat). Never use teal for navigation or chrome; it would dilute the "this came from the model" signal.
- `rose-*` — user errors / detected mistakes (never for destructive buttons)
- `emerald-*` — success, "no errors found", approved
- `amber-*` — pending review (admin queues)

Each surface renders these roles in its own temperature: the learner app uses the warm washi values in `tokens/colors.css`, the admin console the cooler status pairs in `tokens/admin.css`. Same meaning, different values — never swap the meanings.

### Japanese text

Always `lang="ja"` on elements containing Japanese so the browser picks correct CJK glyphs. Long sentences `truncate` on one line with a `title` attribute; full text lives in the detail modal, never wrapped in the row. Reading passages use relaxed leading (`leading-relaxed`).

### Buttons, inputs, focus

`rounded-lg` (8px); inputs 44px tall (also the minimum tap target). Focus = `border-brand-400` plus a 3px translucent brand ring. Never remove the focus ring.

### Icons

2px-stroke SVG from the shared icon set, 20px in nav / 16px inline, inheriting `currentColor`. No icon font, no second icon library, no emoji, no Unicode glyphs (`→`, `✓`) as icons.

### Motion

150ms color transitions, 200ms background, 300ms sidebar collapse, all `ease-in-out`. No bounces, no entrance animations. Card hover never scales or translates.

### Copy

Vietnamese UI, Japanese content, no third language in chrome. Second person informal-polite (*bạn*); the product never says "tôi"/"we". Sentence case everywhere except uppercase 10px table headers. Buttons 1–4 words. Vietnamese thousands separator (`1.482`).

---

## Learner surface (`/`)

**Direction: washi paper + faded indigo ink.** Warm, low-contrast, easy on the eyes for hour-long study sessions. No neon, no saturated dashboard colors, no gradient backgrounds, **no dark blocks anywhere** — not the sidebar, not the header, not a hero.

### Surfaces

- Page background: warm paper `#f7f6f2` (not white). Cards are white on top of it.
- Dark mode: warm charcoals — `#16181a` page, `#212428` card. Never pure black.
- Gray ramp is **warm** (paper-toned), not blue-grey: `gray-800` primary text, `gray-500` secondary, `gray-400` meta.

### Sidebar & navigation — light

White surface, hairline right border, dark text.

- Active row: `bg-brand-100 text-brand-700 font-semibold` (`dark:bg-brand-500/20 dark:text-brand-200`), 8px radius, icon inherits the text color. **Not** a solid `bg-brand-500` block, **not** a dark navy block.
- Hover row: `bg-brand-50` (`dark:bg-white/5`).
- Rest row: `text-gray-500 font-medium`.
- No shadow on nav rows.

### Cards & lists

`rounded-xl border border-gray-200 bg-white shadow-sm` + `dark:border-gray-700 dark:bg-gray-900`. List rows are compact one-per-line horizontal cards, spaced with `flex flex-col gap-2.5` (not `space-y-*`). Hover = border turns `teal-500` + soft shadow.

### Filter chips

`rounded-full px-4 py-1.5 text-xs`; active = `bg-gray-900 text-white` (inverted in dark mode), inactive = bordered, hover border `teal-400`.

### Floating help assistant

One per app, mounted at the shell level (not inside a page body). Launcher FAB bottom-right, 56px, `bg-brand-500`; the panel opens **above** the FAB so it never covers it or the page's own bottom-right controls. It answers *how do I use this website* questions only — Japanese conversation practice lives on the **Luyện hội thoại AI** screen, never in the floating panel.

### Spacing & density

Roomy: 24px page padding, 16–24px between blocks. A learner screen shows fewer things, larger.

---

## Admin surface (`/admin/*`)

**Direction: soft enterprise dashboard.** Clean, light, professional. A cool background that is *not* strongly blue, one decisive Manabi blue for primary actions, lavender for icons and active state, and teal/amber/rose reserved for status. Lots of white space, no heavy borders, medium card radius — never "cute".

Tokens live in `tokens/admin.css`. Put `data-surface="admin"` on the admin shell root and the shared semantic aliases (`--bg-page`, `--text-primary`, `--action-primary`, `--nav-*`, …) resolve to the admin values below. The learner app's warm `brand-*` scale is **not** used on this surface.

### Surfaces

| Role | Hex |
|---|---|
| Page background (xanh xám rất nhạt) | `#F6F8FC` |
| Sidebar | `#FFFFFF` |
| Card | `#FFFFFF` |
| Input fill | `#F3F6FA` |
| Active menu row (lavender nhạt) | `#E8EFFF` |

The **cool page background against white cards** is the main "you are in the admin console" cue — not a dark chrome block. There are no dark fills on this surface: the admin sidebar and header are white, exactly like the cards, separated only by hairline borders.

### Admin blue (`admin-*`)

```
admin-50  #E8EFFF   ← primary tint / active menu
admin-200 #B8C9F2   ← active border
admin-500 #315DCE   ← primary  (Manabi blue)
admin-600 #244DB5   ← primary hover
admin-900 #142B52   ← navy text
lavender-500 #5E6BC4 ← logo mark, icon tiles
```

**Only Manabi blue marks a primary action** — the main button on a screen, a submit, the current page in pagination. Lavender, teal, amber and rose exist to rank information and encode status; they never become an action color. Disabled primary = `admin-200`.

### Text ramp (cool slate)

| Role | Hex |
|---|---|
| Page / card title | `#122B52` |
| Section subtitle | `#29466F` |
| Body | `#536B8D` |
| Meta, secondary | `#8294AF` |
| Disabled | `#B5C1D2` |
| On primary | `#FFFFFF` |

### Status colors (fill / ink)

Status is what admins actually read; keep it boring and consistent.

| Trạng thái | Fill | Ink |
|---|---|---|
| Thành công / đã duyệt | `#E4F5F1` | `#15988E` |
| Đang chờ duyệt | `#FFF3D9` | `#B47A1B` |
| Cần chỉnh sửa | `#FBE9ED` | `#C26678` |
| Thông tin | `#E6F1FC` | `#4B91D2` |
| Lỗi / thất bại | `#FDEBEC` | `#C94D5C` |
| Nháp / trung tính | `#EEF2F7` | `#64748B` |

Badges are pill-shaped, fill + ink from one row above, with a 6px dot in the ink color. Never encode status with admin blue, and never use a status color as a navigation accent.

### Typography

Inter or Plus Jakarta Sans across the whole console.

- Page title: 28–32px / 500–600
- Section title: 16–18px / 600
- Body: 14px / 400
- Small label: 11–12px, uppercase, `letter-spacing: 1.2px`
- Dashboard numbers: 24–28px / 700, in the title navy

### Borders, radius, shadow

- Border: `#E1E8F2` · input border `#DCE5F1` · active/focus border `#B8C9F2`
- Radius: card 14–16px · button 9–10px · input 9px · small avatar & icon tile 10–12px (this **overrides** the shared 8px rule on the admin surface)
- Card shadow: `0 4px 16px rgba(35, 67, 110, 0.05)` — that soft, and no more
- Primary button shadow: `0 5px 12px rgba(49, 93, 206, 0.22)`
- Focus: `#B8C9F2` border plus `0 0 0 3px rgba(49, 93, 206, 0.18)`

### Sidebar & navigation — light

White surface, hairline right border, 20px icons inheriting `currentColor`.

- Active row: `bg-[#E8EFFF] text-admin-600 font-semibold`, 10px radius, icon in `admin-500`. No solid blue block, no dark block.
- Hover row: `#F3F6FA`. Rest row: `#536B8D`, `font-medium`.
- Section labels ("WORKSPACE", "HỆ THỐNG"): 11px uppercase, 1.2px tracking, `#8294AF`.
- Counts sit in a right-aligned `#EEF2F7` / `#64748B` pill.
- No shadow on nav rows.

### Data & density

- Tables, not cards, for anything with more than three columns. 11px uppercase headers, 44px rows, zebra off, hairline row borders.
- Compact spacing: 32px page padding, 16–20px between blocks, 24px card padding.
- Stat cards: lavender/teal/amber icon tile top-left, delta chip top-right, label, then the big number.
- Charts and stat chips use **cool greys plus one Manabi blue**. No decorative purple/orange ramp.

### Destructive actions

Confirm in a modal with the object name in the body text. The confirm button is solid `#C94D5C`; the rose *fill* still means "cần chỉnh sửa" on read-only surfaces, so keep destructive rose confined to buttons and confirmation dialogs.

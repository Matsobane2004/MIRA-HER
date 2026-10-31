# CLAUDE.md: guide for working on MIRA Her

MIRA Her is an anonymous peer support website for women in South Africa (hackathon prototype). Read `README.md` for the product overview and demo accounts.

## Hard constraints

- **Plain HTML, CSS and JavaScript only.** Don't add frameworks, bundlers, npm, TypeScript or ES modules. Use classic `<script>` tags, because ES modules break when pages are opened from `file://`.
- The site must work when served by VS Code Live Server **and** when opened from `file://` in Chrome or Edge.
- Keep everything in English (South African spelling: "colour", "organise", "programme").

## Architecture

```
*.html            one page per file; body attributes tell common.js how to render it
css/styles.css    single design system (tokens in :root)
js/store.js       data layer exposed as window.Store; behaves like an API
js/common.js      window.MIRA helpers + page chrome (top bar, sidebar, footer)
js/pages/<page>.js  each defines window.pageInit(user)
vendor/           Phosphor icons (fill weight) and Leaflet 1.9.4, both local
```

**Script order on every page:** `js/store.js` → `js/common.js` → (vendor libs) → `js/pages/<page>.js`.

### Page attributes on `<body>`

- `data-shell="public" | "auth" | "app"`: which layout `common.js` draws.
  - `public` adds the marketing top bar and footer.
  - `auth` is a minimal bar for log in and sign up.
  - `app` adds the top bar, privacy strip and sidebar, and moves `<main>` into the app layout.
- `data-page="dashboard"`: highlights the nav item.
- `data-auth="required"`: redirects to `login.html?next=…` when logged out.
- `data-auth="guest"`: redirects logged-in users to the dashboard.
- `data-role="moderator"`: role gate (comma-separated list allowed).

### Data layer (`js/store.js`)

- All data is one JSON object in `localStorage` under `miraher.db.v1`. It is seeded by `buildSeed()` on first load.
- The session is in `sessionStorage` (`miraher.session`), so each tab has its own login and closing the tab logs out.
- Every mutation goes through `tx(fn)`, which re-reads the latest data before changing it. This keeps two tabs from overwriting each other.
- Functions validate input and throw `StoreError(message, status)` with friendly, user-facing messages. Pages catch errors and show `err.message`.
- Views (`postView`, `alertView`, `chatView`…) shape what pages receive. Never return password hashes or other users' IDs.
- Cross-tab updates: `Store.onExternalChange(fn)` fires on the browser `storage` event. The chat and notification views also poll every few seconds.
- Passwords use salted, iterated SHA-256 written in pure JS (it works on `file://`, where `crypto.subtle` may be missing). Recovery codes are hashed the same way.
- The automated demo listener ("GentleHeart", id `bot`) joins a waiting chat after 10 s. That wait becomes 60 s while a listener has the Listener Hub open, tracked by the `miraher.presence` heartbeat.

### Moving to a real backend later

Pages only talk to `window.Store`. To add a server, keep the same function names and return shapes, and replace each body with a `fetch()` call. You'll need to make them `async` and add `await` in the page scripts. Do the hashing server-side with bcrypt or scrypt, use HttpOnly session cookies, and keep the same validation messages.

## Conventions

- **Escape all user content** with `MIRA.esc()`, or `MIRA.text()` for multi-line text, before putting it in HTML. Never use raw `innerHTML` with user strings.
- Icons use the solid set: `MIRA.icon('name')` → `<i class="ph-fill ph-name">`. Check that a name exists in `vendor/phosphor/fill/style.css` (`.ph-fill.ph-NAME`). Don't use emoji as icons.
- Brand colours (see `:root`):
  - Purple `#5B2A86`
  - Lavender `#F3ECFA`
  - Coral accent `#FF7A6B`
  - Text `#2A1838`
- Fonts: Poppins (headings) and Inter (body).
- Reuse the existing components (`.card`, `.btn-*`, `.chip`, `.tag`, `.tabs`, `.notice`, `.field`, `.modal`, `MIRA.toast`, `MIRA.confirmBox`, `MIRA.postCard`) before writing new CSS.
- UI copy is warm, plain and short. Write in sentences, avoid jargon, never blame the user.

## Safety rules (don't break these)

- Every page keeps the **Quick Exit** button, and **Esc** must still exit. The first Esc closes an open dialog.
- Never ask for real names, email addresses, phone numbers, ID numbers or precise locations.
- Keep location blurring on alerts, `<meta name="referrer" content="no-referrer">` on every page, and the crisis-language check (`hasCrisisLanguage`) on posts, replies and chat.
- Helpline numbers were verified for South Africa:
  - SAPS: 10111, or 112 from a cellphone
  - GBV Command Centre: 0800 428 428 and *120*7867#
  - Stop Gender Violence: 0800 150 150
  - SADAG Suicide Crisis Line: 0800 567 567
  - Lifeline: 0861 322 322
  - National Shelter Movement: 0800 001 005
  - Childline: 0800 055 555
  - Ambulance: 10177
  Don't change them without checking an official source.
- Health content is general information with "visit a clinic" guidance. Don't add dosages or diagnoses.

## Adding a page

1. Copy an existing app page (for example `journal.html`), change `<title>`, `data-page` and the page script tag.
2. Create `js/pages/<name>.js` with `window.pageInit = function (user) { … }`.
3. Add data functions to `js/store.js` (validate input, use `tx()` for writes, export on `window.Store`).
4. Add it to `APP_NAV` in `js/common.js` if it belongs in the sidebar.

## Testing

- Serve the folder (Live Server, or `python -m http.server 5500`) and click through with the demo accounts.
- To demo the two-person chat, use two windows: log in as BraveLily in one and GentleMoon in the other.
- Use **Reset demo data** (log in page or Settings) to start fresh. After changing `buildSeed()`, reset so the new seed loads.

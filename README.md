# MIRA Her

**A safe space to be heard.** MIRA Her is an anonymous peer support website for women in South Africa. It was built for the Rosebank International *Women Empowerment Through Technology* Hackathon (31 October 2026).

It is plain **HTML, CSS and JavaScript**. There is no server, no framework and no install step.

---

## Run it in VS Code

1. Unzip the folder and open it in VS Code (**File → Open Folder…**).
2. Install the **Live Server** extension (by Ritwick Dey) if you don't have it.
3. Right-click `index.html` and choose **Open with Live Server**.
4. The site opens at `http://127.0.0.1:5500`.

**No VS Code?** You can also double-click `index.html` to open it in Chrome or Edge. Live Server is recommended because some browsers (like Firefox) limit saved data for pages opened straight from a file.

> Map street tiles and the Poppins/Inter fonts load from the internet. Everything else, including the icons and the map library, works offline. Without internet the map still shows the pins on a plain background.

## Demo accounts

| Role | Alias | Password |
|---|---|---|
| Member | `BraveLily` | `demo1234` |
| Peer listener | `GentleMoon` | `listen1234` |
| Moderator | `Moderator` | `moderate1234` |

The log in page has buttons that fill these in for you.

- BraveLily's recovery code, for testing "Forgot password", is `LAVENDER-RIVER-2026-PROTEA-DAWN`.
- **Reset demo data:** use the link on the log in page or in Settings to restore the original content.

## Pages

| Page | File | What it does |
|---|---|---|
| Landing | `index.html` | Hero, how it works, features, safety by design |
| About | `about.html` | Why MIRA Her exists, from MIRA to MIRA Her, what's next |
| Community guidelines | `guidelines.html` | The rules every member agrees to, and how moderation works |
| Privacy & safety | `privacy.html` | What we keep, what we never ask for, deleting your account |
| Get help now | `help.html` | Verified South African helplines. Works without logging in |
| Log in | `login.html` | Alias + password, with demo account buttons |
| Join anonymously | `register.html` | 4 steps: alias and avatar, topics and areas, password, recovery code |
| Reset password | `recover.html` | Uses the recovery code (no email needed) |
| Home | `dashboard.html` | Mood check-in, feed, nearby alerts, suggested circles, sessions |
| Circles | `circles.html` | All anonymous group spaces; join and leave |
| Circle | `circle.html?id=…` | Posts, trigger warnings, reactions, replies, reporting |
| Talk to a listener | `listener.html` | Start a private chat; listeners also see the **Listener Hub** queue |
| Chat | `chat.html?id=…` | Live one-on-one chat, professional help request, rating |
| Safety alerts | `alerts.html` | Map of anonymous reports, report form, alert settings |
| Safety toolkit | `safety.html` | SA safety tips, your rights, private safety plan |
| Health & body | `health.html` | Reproductive health topics, private cycle tracker, ask a nurse |
| Mentorship | `mentorship.html` | Women in tech mentors, requests, workshops with RSVP |
| My journal | `journal.html` | Private entries and a 30-day mood chart |
| Settings | `settings.html` | Avatar, topics, areas, Quick Exit setting, password, recovery code, delete account |
| Moderation | `admin.html` | Moderators only: crisis flags, reports, escalated chats, nurse questions |
| Not found | `404.html` | Friendly error page for hosting |

## Safety features (worth showing the judges)

- **Quick Exit:** the coral button or the **Esc** key wipes the page, logs you out and opens a weather search. The first Esc closes a dialog if one is open.
- **Anonymous accounts:** alias + password only. Passwords are salted and hashed (SHA-256, 2,000 rounds), never stored as typed.
- **Recovery codes** replace "forgot password" emails.
- **Per-tab login:** closing the tab logs you out, so the next person on a shared phone can't get in.
- **Blurred locations:** safety reports are moved by up to 150 m.
- **Crisis detection:** posts, replies and chat messages that suggest someone may be in danger show helplines straight away and alert moderators.
- **Trigger warnings** blur posts until the reader chooses to see them.
- **No referrer:** links never tell other sites you came from MIRA Her.

## A 3-minute demo script

1. **Landing page.** Point out Quick Exit and "no email, no phone".
2. **Join anonymously.** Shuffle an alias, pick topics, create a password, and show the recovery code.
3. **Home.** Do a mood check-in and react to a post with "Sending strength".
4. **Circle.** Write a post with a trigger warning and show how it's blurred.
5. **Safety alerts.** Tap the map, report "Followed or threatened", and watch the pin appear.
6. **Talk to a listener (two windows).** Log in as BraveLily in one window and as GentleMoon in a second window (`Ctrl+N`). GentleMoon opens **Listener Hub**, BraveLily starts a chat, and GentleMoon accepts and replies live. If no listener is online, the automated demo listener *GentleHeart* joins after about 10 seconds.
7. **Moderation.** Log in as Moderator to show crisis flags, reports and answering a nurse question.
8. **Finish on Quick Exit:** press **Esc**.

## What works today vs. what's next

**Works now:** accounts and login, recovery codes, circles, posts, replies, reactions, reports, mood check-ins, journal, safety plan, safety alerts with a map, peer chat between tabs, an automated demo listener, mentorship requests, workshop RSVPs, nurse Q&A, moderation, notifications and account deletion.

**Prototype limits:** data is saved in this browser only (`localStorage`), so it isn't shared between devices, and anyone with access to the browser's developer tools could read it.

**Next steps:**
- A secure backend and database (see `CLAUDE.md`)
- AI-assisted moderation
- Trained listener onboarding with NGOs
- South African languages
- A campus pilot

## Folder structure

```
mira-her/
├── *.html               one file per page
├── css/styles.css       the whole design system
├── js/store.js          data layer: accounts, posts, alerts, chat... (acts like an API)
├── js/common.js         shared layout, Quick Exit, notifications, helpers
├── js/pages/*.js        one script per page
├── img/                 photos and the logo
└── vendor/              Phosphor icons (solid) and Leaflet map library, both MIT licensed
```

## Credits

- Icons: [Phosphor Icons](https://phosphoricons.com) (MIT)
- Map: [Leaflet](https://leafletjs.com) (BSD-2) with © OpenStreetMap contributors
- Fonts: Poppins and Inter (Google Fonts)

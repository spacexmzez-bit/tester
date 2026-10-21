# Google Play 12-Tester Tracker & Peer App Testing Suite

A clean, modern, lightweight web application suite built to help Android developers manage and track Google Play closed testing compliance:
1. **My Apps (12 Testers Tracker)**: Track your own apps, manage testers (Single Entry with 14-day calculations & daily usage logs, plus Community Testers), and monitor the 12-tester requirement.
2. **Testing Other People's Apps (Peer Testing)**: Dedicated page to track apps you test for other developers (assigned to **Mazen** or **Marwan**), with testing checkpoints at **Day 3, Day 7, and Day 12**, automatic **"Test overdue"** tags, dual end-date intervals (**Mandatory 14 Days** & **Buffer 16 Days**), and 1-click **Complete & Remove**.

Built for zero-friction hosting on **GitHub Pages**, with seamless cross-device syncing via a **Cloudflare Worker** and KV storage.

---

## What's Included

```text
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions CI/CD for Pages & Cloudflare Worker
├── deploy.yml.txt          # Plain-text copy of deploy.yml for easy copy-pasting
├── index.html              # Main dashboard for your own apps (12-tester tracker)
├── testing_others.html     # Dedicated page for testing other people's apps (Mazen/Marwan)
├── setup.html              # Interactive visual deployment and setup guide
├── worker.js               # Cloudflare Worker syncing both my apps & peer testing apps
├── wrangler.toml           # Cloudflare Wrangler deployment configuration
└── README.md               # Complete documentation
```

---

## Key Features

### 1. Dedicated Page for Testing Others' Apps (`testing_others.html`)
- **Add App to Test**: Assign App Name, select whether **Mazen** or **Marwan** is testing, and pick start date.
- **Dual End Dates**:
  - **Mandatory 14 Days**: Exact 14-day closed testing completion date.
  - **Buffer 16 Days**: Safe buffer date recommended for time-zone offsets and store review.
- **Testing Intervals (Day 3, Day 7, Day 12)**:
  - Check-in buttons at the 3rd, 7th, and 12th day.
  - **"Test overdue" Tag**: If today passes any interval date without being logged, a prominent red tag **"⚠️ Test overdue"** appears on the card.
- **Filter by User**:
  - Filter apps to see **All Apps**, **Mazen's Tests**, **Marwan's Tests**, or **Overdue Only**.
- **Complete & Remove**:
  - When the testing period ends, clicking **"Complete & Remove from Site"** completely deletes the app from the site and syncs across devices.

### 2. My Apps 12-Tester Tracker (`index.html`)
- App cards with opt-in testing links, custom categories, icons, and live progress bars toward 12 testers.
- Two tester tracking modes: Single Entry (with daily 14-day usage logger) & Community Testers.
- Category configuration in Settings.

### 3. Server Sync across Devices (Cloudflare Worker)
- Zero complex database setup: stores data in `localStorage` for offline speed and syncs to a Cloudflare Worker backed by KV storage via a private **Sync Passkey**.
- Both Mazen and Marwan can access the same data on phones, tablets, or PCs.

---

## Quickstart

1. Push this repository to GitHub.
2. In GitHub repository **Settings > Pages > Source**, select **GitHub Actions**.
3. Deploy the Cloudflare Worker using Wrangler (`npx wrangler deploy`) or Cloudflare Dashboard.
4. Open the site, go to **Settings (⚙)**, and enter your Worker URL and private Sync Passkey.

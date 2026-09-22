# Sprint Tracker

A web application to track the consumption of available days within development sprints. Automatically recalculates sprint end dates and shifts subsequent sprints when developers are unavailable.

## Features

- **Multi-project support** — Track sprints for multiple clients/projects simultaneously
- **Excel-like grid editing** — Toggle worked/not-worked days with a single click, add comments for context
- **Auto-recalculation** — When a developer is absent, all subsequent sprint dates are automatically updated
- **Dashboard** — Progress stats, burn rate, absence log, and sprint timeline overview
- **Sharing** — Give another account full edit access, or publish a secret read-only link
- **Import/Export** — Save and restore all data as JSON files
- **Weekend awareness** — Weekends are automatically skipped in sprint calculations

## Quick Start

```bash
npm install
npm run dev
```

This starts both the API server (port 3001) and the Vite dev server (port 5173). Open http://localhost:5173 in your browser.

## Production

```bash
npm run build
npm start
```

This builds the React frontend and serves everything from the Express server on port 3001.

## How It Works

1. **Create a project** with a name, client, start date, days per sprint (default: 18), and number of sprints
2. **Add developers** to the project
3. **Track daily availability** using the grid view — click the toggle to mark a day as worked (green) or not worked (red)
4. **Add comments** to explain absences (e.g., "sick leave", "public holiday")
5. **View the dashboard** for progress stats and the impact of absences on sprint timelines

### Sprint Calculation Logic

- Each working day, each developer contributes 1 day to the sprint
- With 2 developers, 2 days are consumed per working day
- A sprint of 18 days takes ~9 working days with 2 developers
- If a developer is absent, only 1 day is consumed that day, extending the sprint
- Subsequent sprints start the day after the previous sprint ends
- Weekends (Saturday/Sunday) are automatically skipped

## Sharing a project

Two independent mechanisms, both managed from the share dialog on a project page
(the share icon in the toolbar):

| | Who | Access | Managed by |
|---|---|---|---|
| **User share** | An existing account, by email | Full edit access to the project, its developers and day entries. Cannot delete, archive or manage sharing. | Owner |
| **View-only link** | Anyone holding the URL — no account needed | Read-only view at `/shared/<token>`, with two tabs: a *summary* (days consumed per sprint × developer, absences, projections) and a *day-by-day* detail — the same grid as the editor, without any control. CSV export on both. | Owner |

The view-only link is meant for an assistant or a client who only needs to read
the figures. Notes:

- The token (64 hex chars) *is* the credential — treat the URL as a secret.
- Anonymous visitors never touch the tables: they call the `get_shared_project`
  RPC, which is `SECURITY DEFINER` and returns only the fields the consumption
  view needs, for that single project.
- **Absence comments are deliberately not exposed** through the link, since they
  often carry personal context (sick leave, etc.). The day-by-day grid therefore
  shows *that* a day was missed, never *why*.
- Revoking deletes the link row: the URL stops working immediately.
- Only the project owner can create or revoke links — a shared editor cannot.

## Database migrations

Migration files live in `supabase/migrations/` and **must** be named
`<14-digit-timestamp>_name.sql` (e.g. `20260623091143_add_project_archived.sql`).
The timestamp determines the apply order and is the key Supabase uses to track
what has already run, so always create migrations with the CLI rather than by hand:

```bash
make db-new NAME=add_some_column   # wraps `supabase migration new` → correct timestamp
make db-migrate                    # apply pending migrations locally
make db-check                      # validate filenames (also enforced in CI before db push)
```

## Tech Stack

- **Frontend**: React 18 + React Router + Vite
- **Backend**: Express.js
- **Storage**: JSON file (data.json, created automatically)
- **Styling**: Custom CSS (no framework dependency)

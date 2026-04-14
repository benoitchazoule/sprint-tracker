# Sprint Tracker

A web application to track the consumption of available days within development sprints. Automatically recalculates sprint end dates and shifts subsequent sprints when developers are unavailable.

## Features

- **Multi-project support** — Track sprints for multiple clients/projects simultaneously
- **Excel-like grid editing** — Toggle worked/not-worked days with a single click, add comments for context
- **Auto-recalculation** — When a developer is absent, all subsequent sprint dates are automatically updated
- **Dashboard** — Progress stats, burn rate, absence log, and sprint timeline overview
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

## Tech Stack

- **Frontend**: React 18 + React Router + Vite
- **Backend**: Express.js
- **Storage**: JSON file (data.json, created automatically)
- **Styling**: Custom CSS (no framework dependency)

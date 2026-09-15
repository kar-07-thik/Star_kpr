# STARS-BCA — Frontend

A React + Tailwind frontend for the Student STAR Framework Management System,
built to match the uploaded "STARS-BCA" login screen and extended to cover the
Student, Faculty, and Principal workflows from the project spec.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## What's included

- **Login (`/`)** — recreates the uploaded book-style login screen (logo,
  Register number / password fields, show/hide password, Forgot password,
  Sign In), plus a role switcher (Student / Faculty / Principal) since the
  spec defines three roles. This demo has no backend, so any non-empty
  Register number + password signs you into the selected role's dashboard.
- **Student dashboard (`/student`)** — total points, completed/pending tasks,
  STAR % ring, available STAR tasks with an evidence-upload modal, a
  submissions table with status + faculty feedback, and a recent-activity feed.
- **Faculty dashboard (`/faculty`)** — pending/approved/rejected counts, a
  submissions table, a review modal to open evidence, enter score + STAR %,
  add remarks, and approve/reject, plus a department-performance chart.
- **Principal dashboard (`/principal`)** — institution-wide stats, a
  department ranking table, a points-by-department chart, top-performing
  students, and an "Export Report" action.

## Wiring up the real backend

All mock data lives in `src/data/mockData.js`, with comments mapping each
export to the REST endpoint it should eventually come from (e.g.
`GET /api/tasks`, `GET /api/departments/stats`). Swap those for `axios` calls
into the Node/Express + MongoDB API described in the project spec, and add
JWT-based auth in `Login.jsx` in place of the current demo `navigate()` call.

## Stack

React 18, React Router 6, Tailwind CSS, Recharts, Vite.

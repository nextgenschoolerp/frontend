# Oakridge Academy – School ERP frontend

React + Vite implementation of the school administration prototype (Figma: `schoolerp`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Sign-in and the auth-related screens call **authservice** (default `http://localhost:8082/authservice`) through the Vite dev proxy.
Start authservice (8082, `/authservice`) and admissionservice (8083, `/admissionservice`), then sign in with a seeded account (see [`docs/authservice-api-mapping.md`](docs/authservice-api-mapping.md)).
Point the proxy elsewhere with `AUTH_SERVICE_URL=http://host:port/authservice npm run dev`.

## Screens (all 17 from the Figma file)

| Route | Screen |
| --- | --- |
| `/` | School overview (dashboard) |
| `/students` · `/students/new` · `/students/:id` · `/students/:id/edit` | Students directory, Add, Profile, Edit |
| `/staff` · `/staff/new` · `/staff/:id` · `/staff/:id/edit` | Staff directory, Add, Profile, Edit |
| `/academics` `/attendance` `/fees` | Operations |
| `/calendar` `/communications` `/reports` `/documents` | School management |
| `/settings` `/help` | Settings, Help & support |
| `/login` `/forgot-password` `/reset-password` `/change-password` | Sign in and password lifecycle (authservice) |

## Structure

- `src/components/Layout.jsx` – sidebar, toolbar and breadcrumbs shared by every screen
- `src/components/ui.jsx` – shared building blocks (cards, metrics, tables, pills, form fields)
- `src/pages/*` – one file per area; sample data lives next to each page
- `src/styles.css` – design tokens (colours, radii, type) taken from the Figma file

- `src/api/*` – fetch client, authservice endpoint functions and the `useApi` loading hook
- `src/components/AuthShell.jsx`, `AuthSettings.jsx` – sign-in layout, role and security cards
- `docs/authservice-api-mapping.md` – every UI action mapped to its authservice endpoint, roles and status
- `docs/admissionservice-api-mapping.md` – admissions screens (Students → Admissions, Add student, Overview) mapped to admissionservice endpoints

Authentication, roles, MFA, session settings and campuses come from authservice. Everything else (students, staff,
attendance, fees, …) is still static sample content from the prototype.

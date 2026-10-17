# Oakridge Academy – School ERP frontend

React + Vite implementation of the school administration prototype (Figma: `schoolerp`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Screens (all 17 from the Figma file)

| Route | Screen |
| --- | --- |
| `/` | School overview (dashboard) |
| `/students` · `/students/new` · `/students/:id` · `/students/:id/edit` | Students directory, Add, Profile, Edit |
| `/staff` · `/staff/new` · `/staff/:id` · `/staff/:id/edit` | Staff directory, Add, Profile, Edit |
| `/academics` `/attendance` `/fees` | Operations |
| `/calendar` `/communications` `/reports` `/documents` | School management |
| `/settings` `/help` | Settings, Help & support |

## Structure

- `src/components/Layout.jsx` – sidebar, toolbar and breadcrumbs shared by every screen
- `src/components/ui.jsx` – shared building blocks (cards, metrics, tables, pills, form fields)
- `src/pages/*` – one file per area; sample data lives next to each page
- `src/styles.css` – design tokens (colours, radii, type) taken from the Figma file

Data is static sample content from the prototype; no backend is connected yet.

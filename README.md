# Barangay 181 BMIS: Frontend

Frontend prototype of the Barangay 181, Zone 16, District II, Manila Information Management System.

> **Frontend only.** All data is mock data and every access check runs in the browser.
> This is for demonstration and testing, not security. The backend (Laravel + MySQL) comes in a later phase.

## Run

```bash
npm install
npm run dev        # http://localhost:5181
npm run build      # type-check + production build
```

## Demo accounts

Demo mode (on during `npm run dev`, or with `VITE_DEMO_MODE=true`) shows a role switcher bar and one-click demo sign-in.
Accounts and the shared demo password are in `src/mocks/users.ts`.

## Structure

```
src/
  config/        permissions.ts (role matrix), navigation.ts (sidebar + route registry), app.ts (settings)
  types/         domain types shared by mocks, services and pages
  mocks/         MOCK DATA ONLY: deterministic fictional records
  services/      data-access layer; each function returns a Promise so it can be swapped for an API call
  auth/          simulated session, permission checks, route guards
  components/    ui/ (design system), layout/ (shell, sidebar, header), charts/
  pages/         grouped by module
docs/            PERMISSION_MATRIX.md (draft for review)
```

**Integrating the backend later:** replace the body of each `services/*.ts` function with a `fetch` to the API. Pages and components only use services, never mocks directly.

## Design system

Tokens are in `src/index.css` (`@theme`). They were measured from the Figma Final Inspo frame (node 249-3847): Manrope for titles and figures, Inter for interface text, navy `#002132`, canvas `#F4F7F8`, 1px `#D6D9DE` borders, 15px card radius.

## Placeholders to replace

- **Barangay seal:** `src/components/layout/BarangaySeal.tsx` shows a "181" placeholder.
- **Purok names:** Purok 1–6 follow the Figma reference and haven't been confirmed.
- **Lockout threshold (5) and session length (30 min):** assumptions in `src/config/app.ts`.

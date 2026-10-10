# React + Vite

## Supabase setup

The app reads the Supabase project URL and **publishable** key from Vite
environment variables. Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` is ignored by Git. Never put a `service_role` or secret API key in
the browser app or a `VITE_` variable. Restart the Vite dev server after changing
environment variables.

Apply the repository migrations in filename order before using live signup,
private NGO document review, donation pickup pins, 10 km claim validation, and
in-app status notifications. Configure Supabase Auth email confirmation and the
site's redirect URLs for local development and production. If email confirmation
is enabled, NGO users sign in after confirming and submit their ID document from
the registration review page.

Nearby browser alerts are opt-in and work while the NGO feed is open. Status and
verification changes appear in the in-app notifications menu. Email/SMS and
offline push delivery need a separately configured notification provider.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

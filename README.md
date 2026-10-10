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
in-app status notifications. Apply all migrations through
`0020_restrict_donation_inserts_to_donors.sql` for the latest donation access
policy. Turn off
**Confirm email** in the Supabase Dashboard under **Authentication → Sign In /
Providers → Email** to enable immediate signup and login. Charities can sign in
immediately but stay on the registration review page, and cannot browse or
claim donations until an administrator approves their application.

### Login/signup reports that `public.profiles` is missing

The configured Supabase project must have the repository migrations applied.
From the repository root, link the Supabase CLI to the same project used by
`VITE_SUPABASE_URL` and push the migrations:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

Apply migrations in filename order if you use the Supabase Dashboard SQL Editor
instead, including `0019_admin_donor_directory.sql`. Migration
`0018_repair_existing_auth_profiles.sql` repairs Auth accounts that were
created without a profile and ensures new users trigger profile creation. If
the migrations are applied but the schema cache error remains, run this in the
SQL Editor to refresh PostgREST's schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

### Posting food reports that `delivery_radius_km` is missing

The pickup pin and fixed 10 km radius are added by migrations
`0014_donation_pickup_map_and_radius.sql` and
`0015_set_delivery_radius_to_10_km.sql`. Apply all pending migrations in
filename order using `supabase db push` or the Supabase Dashboard SQL Editor.
If those migrations are already applied, run `NOTIFY pgrst, 'reload schema';`
in the SQL Editor, then refresh the app.

### Posting food reports a row-level security error

The insert policy only allows active donor profiles to post an available listing
owned by their signed-in user ID. Apply migration
`0020_restrict_donation_inserts_to_donors.sql`, then sign in with a donor
account. The app supplies the authenticated user ID as the listing owner.

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

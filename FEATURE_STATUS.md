# DastarKhan feature status

**Checked:** 2026-10-09  
**Scope:** Default local-demo configuration, followed by code inspection and a browser walkthrough. “Complete” means the workflow works in the demo, not that it is production-secure. Supabase has not been configured or connected to the auth provider in this workspace.

## Summary

| Status | Meaning |
|---|---|
| Complete in the local demo | Feature flow can be exercised using local demo data. |
| Implemented; requires Supabase setup | Code and migrations exist but must be applied/configured and tested against the live project. |
| Incomplete | Additional implementation or operational backfill is still required. |

## Feature checklist

| Feature | Status | Verified behavior / remaining work |
|---|---|---|
| Landing page, animated illustration, navigation, and shared footer | **Complete** | Uses the existing green/warm-neutral theme, shared logo/footer, responsive layout, and reduced-motion-aware animation. The home page has no food listing cards. |
| Login, donor/NGO/admin demo roles, sign-up, and sign-out | **Complete — demo only** | NGO signup requires a charity registration number, representative ID number and file, and an official verification link. New registrations remain pending. The local demo stores the ID file in browser storage; never submit a real ID card until private production storage is connected. |
| Route access restrictions | **Complete — client-side demo only** | Donor, NGO, admin, and impact routes are protected by role. Pending/rejected NGOs are held at a verification status page until an admin approves them. `/dashboard` has one donor/NGO-guarded registration. This is not a substitute for database security. |
| Donor create, read, edit, cancel, and anonymity preference | **Complete — demo; live schema migration required** | Donation signup includes an OpenStreetMap pickup-pin picker, with current-location support and a fixed 10 km circle. Coordinates persist with the listing; the same pin is used for charity distance checks and map links. |
| NGO available-food feed | **Complete — demo; live RPC code unverified** | Verified NGOs explicitly share their current device location to see only pickup pins within the fixed 10 km delivery radius. Listings show straight-line distance and link to the exact pickup pin. |
| NGO claim creation | **Complete — demo; live RPC code unverified** | Only an approved NGO within 10 km of a donation pickup pin can claim it. The location and radius are checked in the claim flow; duplicate/expired/out-of-range claims are rejected. |
| NGO claims, pickup, and delivered weight | **Complete — demo only** | Claim ownership and sequential transitions are checked. Delivery requires a valid non-negative actual kg value. |
| Listing details and status timeline | **Complete — demo only** | A charity can open its claimed donation and see the locally recorded available/claimed/pickup/delivery history. Supabase history is read from the audit log when configured. |
| Impact dashboard and landing-page figures | **Complete — demo data / account-visible live data** | Demo figures now derive from actual local donation statuses and update on listing changes instead of displaying hard-coded totals. Live Supabase figures are limited to records visible under the current user's RLS policies. |
| Admin food-listing CRUD and soft removal | **Complete — demo; live RPC code unverified** | Admins can create listings, edit details for records in any workflow state, search/filter all records, and remove available/claimed donations from the active feed. Removal uses cancellation and preserves donation/status history; edits cannot rewrite ownership, claims, delivery status, or delivered weight. |
| Admin NGO verification and access controls | **Complete — demo; live RPC code unverified** | Admins can inspect the registration number, representative ID number/document, and official link, then approve, reject with a note, or request information. NGOs can resubmit evidence. Approval requires all evidence; pending/rejected NGOs cannot access food workflows. Admins can also disable/re-enable NGO accounts with a required reason. |
| Live Supabase authentication and private NGO evidence | **Implemented; requires migration and project configuration** | `.env.local` provides the Supabase URL and publishable key. Signup, login, sessions, profile loading, private ID uploads, signed admin review links, and review/resubmission call Supabase Auth, Storage, and RPCs. Email confirmation must be configured with the app redirect URL. |
| In-app status notifications | **Implemented; requires migration** | Supabase records claim, pickup, delivery, cancellation, and NGO review notifications; the signed-in user has a realtime notifications menu. Optional browser alerts report new donations within 10 km while the NGO feed is open. |
| Shared loading, empty, error, and not-found states | **Complete — UI/demo coverage** | Relevant feed, claims, detail, admin, auth, and impact flows expose their loading/error/empty states. |
| Shared logo and authenticated navigation | **Complete** | Landing, auth, role pages, loading states, footer, and not-found use the shared logo. Authenticated mobile navigation has role-appropriate links and a working drawer. |
| Responsive layout, focus states, and motion preferences | **Complete — code/browser checked** | Layout rules include mobile/tablet/desktop breakpoints and reduced-motion support. Final device/browser matrix should still be checked on real devices. |
| Supabase auth and real account registration | **Incomplete** | `AuthContext` still uses local demo auth. Supabase NGO sign-up needs server-side role/profile provisioning and private Storage uploads; do not treat browser metadata as an authorization mechanism. The ID file in the local demo is stored unencrypted in browser storage and must not contain a real identity document. |
| Supabase donor create/edit/cancel and anonymity | **Incomplete** | Donor listing API and profile preference are local-demo operations, not database-backed. |
| Full live Supabase workflow | **Incomplete / unverified** | Feed, claims, status RPCs, impact, and admin paths have Supabase code, but no project credentials or Supabase Auth session are configured to exercise them end to end. Apply migrations `0014_donation_pickup_map_and_radius.sql` and `0015_set_delivery_radius_to_10_km.sql` for pickup coordinates, a fixed 10 km radius, and server-side range checks during claims. |
| Apply and verify admin migrations | **Incomplete outside repository** | Apply migrations `0009_admin_moderation.sql` through `0019_admin_donor_directory.sql` to the target Supabase project and verify grants/RLS before using live admin tools. |
| Backfill legacy pickup pins | **Not completed** | Existing donations without coordinates are excluded from nearby search. Edit each listing and set its actual pickup pin; no exact coordinates are inferred from private street addresses. |
| Production readiness | **Incomplete** | Local storage is editable and browser-only; configure and test server auth, migrations, RLS, RPCs, and live data before deployment. |

## Screens and user flows

| Route / surface | Access | Existing behavior |
|---|---|---|
| `/` | Public | Animated illustration, how-it-works, role overview, current impact summary, calls to action, and shared footer. |
| `/auth/login` | Public | Validated login, errors, and donor/NGO/admin demo-account shortcuts. |
| `/auth/signup` | Public | Donor/NGO role selection; NGO registrations require the charity reference, representative ID number/photo or scan, and official verification link. New NGO applications are pending admin review. |
| `/ngo/verification` | Signed-in NGO | Shows review notes and lets an NGO securely upload/update required evidence or respond to an information request while awaiting administrator approval. |
| `/donor/listings` | Donor | Own listing history, status views, anonymity preference, edit/cancel actions, and data states. |
| `/donor/listings/new` | Donor | Validated surplus-food listing creation with an interactive OpenStreetMap pickup pin and fixed 10 km delivery circle. |
| `/donor/listings/:id/edit` | Donor | Own available-listing edit workflow, including its persisted pickup pin. |
| `/ngo/feed` | NGO | Current available donations filtered to a 10 km radius around the NGO’s explicitly shared device location, with exact-pin map links. |
| `/ngo/listings/:id` | NGO | Donation details, availability-checked claim action, map link, and status history. |
| `/ngo/claims` | NGO | Active/completed claim views, pickup transition, delivered kg entry, and Maps links. |
| `/dashboard` | Donor/NGO | Visible-record impact totals, rescue status breakdown, and city summary. |
| `/admin/listings` | Admin | All-listing status counts/filters, search, audit-preserving cancellation of active listings. |
| `/admin/listings/new` | Admin | Validated admin-created listing; server pins initial status to available and assigns the admin as the record owner. |
| `/admin/listings/:id/edit` | Admin | Update listing details for any status while preserving ownership, status, claim/delivery fields, and audit history. |
| `/admin/ngos` | Admin | Searchable NGO directory with private ID evidence and official-link review, approve/reject controls, and access controls to disable/re-enable accounts. |
| `/admin/donors` | Admin | Searchable donor directory with contact details, listing counts, anonymity preference, and account access status. |
| `*` | Any | Shared-logo not-found screen and footer. |

Primary workflow: donor creates an available listing → NGO finds and claims it → NGO marks pickup → NGO enters actual delivered kilograms → claim and impact views refresh. Admins can create and edit all listing records, soft-remove active listings while retaining history, and disable/re-enable NGO access with a recorded reason.

## Design system and setup

- Existing brand palette: green primary, warm neutral surfaces, dark ink, semantic status colors; CSS tokens live in `src/index.css`.
- Shared primitives: `Logo`, `Navbar`, `SiteFooter`, auth fields/buttons, page states, listing/status badges, and responsive card/table styles.
- Animation: CSS transitions and the landing illustration; `prefers-reduced-motion` is respected. No animation dependency was added.
- No new package dependency is required. Use the repository's existing `npm install`, `npm run dev`, `npm run lint`, and `npm run build`.
- Supabase URL and publishable key are read from the ignored `.env.local` file; see `.env.example`. Apply all migrations through `0016_live_auth_reviews_and_notifications.sql`, then configure Auth redirect URLs and validate live RLS/storage/RPC behavior before launch.

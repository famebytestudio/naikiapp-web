# Landing page and motion

The landing hero text, actions and 12-second SVG animation stay together in
`src/pages/Landing/index.jsx`. The rest of the page uses
`src/pages/Landing/landing.css`: the donation journey, donor/charity cards,
recorded impact, community links, FAQ and closing invitation.

## Complete components and placement

- `src/components/HeroFlowAnimation.jsx` contains the full inline SVG and single
  GSAP timeline. It is the second child of `.landing-hero-inner`, immediately
  after `.landing-copy`. Its responsive sizing and playback styles are in
  `src/index.css` under `.landing-art`.
- `src/components/AuthRescueAnimation.jsx` is the silent eight-second sharing
  animation on both auth pages. `AuthShell.jsx` places it between the story
  introduction and the three story points. Styling is in
  `src/components/public.css`.
- Both animations pause off screen and when the tab is hidden, offer a keyboard
  accessible pause/play button, and display still artwork for reduced motion.
- The hero uses transform, opacity and route stroke-dashoffset animation.
  Its source SVG/component is about 19.5 KB; combined with the installed GSAP
  core and MotionPathPlugin minified distributions it is about 114.4 KB,
  excluding React and the rest of the application. No external images or video
  files are downloaded.

## Dependencies

GSAP is already declared in `package.json`. Run `npm install` for a fresh
checkout. MotionPathPlugin is included in GSAP; no additional animation package
or API key is required. Reference:
[GSAP MotionPathPlugin](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/).

## Values to adjust

| Value | Location |
| --- | --- |
| Hero duration/speed | `<HeroFlowAnimation duration={12} />`; use 16 for a slower loop. All phases and ambient motion scale together. |
| Hero phase boundaries | Timeline labels at 0, 2, 4, 6, 9 and 11 seconds. |
| Main green | SVG fill/stroke `#2D6A4F`. |
| Orange accents | SVG fill/stroke `#D9822B`. |
| Hero circle | SVG fill `#F1F6F1`. |
| Route | `ROUTE` constant in HeroFlowAnimation. Keep endpoints aligned with pickup and handover. |
| Maximum hero width | `.landing-art-illustration` max-width: 560px. |
| Small-screen detail cutoff | 420px in the hero setup and responsive CSS. |
| Auth short timing | AuthRescueAnimation timeline, 0–8 seconds. |

## Public community pages

`/registered-ngos` and `/top-donors` share
`src/pages/Community/CommunityDirectory.jsx`. PublicHeader and SiteFooter link
to both pages. Mobile navigation includes the same links. Admin NGO management
remains at its protected `/admin/ngos` route.

Demo mode uses the existing browser-local demo records and labels them as demo
data. The donor leaderboard counts only completed deliveries and sums actual
`delivered_kg`. It excludes anonymous and disabled donors. Ties are resolved
by completed delivery count, then name; the list includes up to 50 donors.
The NGO directory excludes disabled accounts. Public results contain only
names and donor aggregates, without contacts, registration references or IDs.

For a configured Supabase backend, apply
`supabase/migrations/0012_public_community.sql` after the existing migrations.
It adds the read-only `get_public_community()` RPC for anon/authenticated users
without opening direct profile or donation access. This migration has not been
applied to a remote database by this change. A failed request shows a retry state
instead of demo records.

## Verification

- Production build and lint (four pre-existing lint warnings in other files).
- All five pages at 360, 768, 1024 and 1440px without horizontal overflow.
- Hero phase positions, second-loop reset, pause/play, off-screen pause,
  reduced-motion changes and console errors.
- Public navigation, hash links, directory search, donor totals and anonymous
  exclusion in the demo store.
- Auth animation pause/play and reduced-motion still frame.
- Demo donor login/signout and NGO signup, including the new organisation in the
  public directory.
- The public SQL migration executed in an isolated PostgreSQL-compatible PGlite
  database: public RPC access, private table denial, anonymous/disabled exclusion,
  completed-delivery totals and tie ordering. This does not replace deployment
  verification against a configured Supabase database.

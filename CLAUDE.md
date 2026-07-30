# Salam Motors

Vehicle inventory, compliance, and sales management. React 18 + TypeScript + Vite + Tailwind, Supabase backend, `react-i18next` for copy.

App code lives in `project/`. Run commands from there.

```
npm run dev         # vite dev server
npm run typecheck   # tsc --noEmit
npm run lint
npm run test        # vitest
npm run test:all    # typecheck + lint + test
```

## Two UIs, one codebase

`useIsMobileViewport()` (`max-width: 767px`) picks the shell in `App.tsx`. Below that breakpoint `MobileApp` renders instead of the desktop tree — they are **separate component trees with separate design systems**, not one responsive layout.

| | Desktop | Mobile |
|---|---|---|
| Screens | `src/pages/` | `src/mobile/` |
| Primitives | `src/components/ui/` | `src/mobile/ui/` |
| Tokens | `brand.*` / `accent.*` / Tailwind slate | `mobile.*` |
| Font | Inter (`font-sans`) | Roboto body, Poppins headings |
| Wrapper | — | `.mobile-shell` class |

**A UI change to one does not affect the other.** When asked to change a screen, establish which side it's on first — `MobileVehicleDetail.tsx` and `VehicleDetail.tsx` are different files with different token vocabularies. If a change should apply to both, that's two edits, and say so rather than silently doing one.

## Design tokens

Defined in `project/tailwind.config.js`. **Use these — never introduce a raw hex, an arbitrary `[#...]` value, or an off-scale shadow.** If a needed token is genuinely missing, add it to the config rather than inlining it at the call site.

**Mobile** (`mobile.*`): `primary` `#D84E55` (+`-hover`/`-active`), `secondary` `#FFCB66` (+`-hover`), `navy` `#162B4E`, `success`/`error`/`warning` each paired with a `-bg` tint, `text`/`text-secondary`/`text-muted`, `bg` `#F7F8FA`, `card` white, `border` `#E2E5EA`.

**Desktop**: `brand.50–950` (blue, primary actions), `accent.50–900` (emerald), Tailwind `slate` for text/surfaces/borders.

**Shadows**: `shadow-card` / `card-hover` (desktop), `shadow-mobile-sm` / `-md` / `-lg` (mobile). No `shadow-lg`, no custom `box-shadow`.

**Radius**: mobile cards `rounded-2xl`, mobile buttons/inputs `rounded-xl`, desktop cards `rounded-xl`, pills `rounded-pill`.

**Motion**: `animate-fade-in`, `slide-up`, `scale-in`, `slide-in-right`, `pulse-soft`. Durations are already tuned (150–250ms) — don't hand-roll new keyframes for standard enter/exit.

## Primitives — reach for these before writing markup

**Mobile** (`@/mobile/ui/primitives`): `Button` (`primary`|`secondary`|`ghost`|`danger` × `sm`|`md`, has `loading`), `Input`, `Select`, `Field`, `Card`, `Tag` (`primary`|`secondary`|`success`|`error`|`warning`|`neutral`|`navy`), `EmptyState`, `TopBar`, `Sheet`, `SegmentedTabs`, `Spinner`. Plus `FileUploadGrid`, `VehicleSelectField`.

**Desktop** (`@/components/ui/`): `Card`, `StatCard`, `EmptyState`, `PageHeader`, `Tabs`, `Field`, `Select`, `Spinner`, `LoadingPage`, `Modal`, `SideNav`, `ScoreRing`, `Lightbox`, `InlineEditableField`, `useToast`, and the badge family — `Badge`, `StatusBadge`, `ScoreBadge`, `AgeingBadge`, `ComplianceBadge`, `VerificationBadge`.

Desktop also has CSS component classes in `src/index.css`: `.card`, `.card-hover`, `.input`, `.label`, `.btn-primary`/`-secondary`/`-ghost`/`-danger`/`-sm`, `.badge`, `.stat-label`, `.stat-value`.

Domain-meaning badges (status, compliance, ageing, score) already encode the business rules and color bands. Use them instead of picking a color by hand — a hand-picked `Tag color="error"` for a compliance state will drift from `ComplianceBadge`.

## Mobile-specific constraints

- **Do not lower the font-size of mobile form fields below 16px.** `.mobile-shell input/select/textarea` is pinned to 16px because iOS Safari zooms the viewport on focus below that. To visually shrink a field, apply `.mobile-input-scale` (transform-based, keeps computed size at 16px). The comment in `src/index.css` explains the mechanism — read it before touching field sizing.
- Touch targets: minimum 44px effective height for anything tappable.
- `overflow-x` is deliberately clamped at `html`, `body`, and `.mobile-shell`. Don't add wide fixed-width elements that fight it.

## Copy

All user-facing strings go through `react-i18next` (`useTranslation`). Don't hardcode English in JSX — add a key. Layouts must tolerate longer translated strings; don't rely on a label fitting in a fixed-width box.

## Making a UI change

1. Identify the side (mobile vs desktop) and the exact file.
2. Compose from existing primitives and tokens. Reuse beats reinvention.
3. Keep the change scoped to what was asked — don't refactor shared primitives, restyle neighbouring screens, or add dependencies as a side effect. If a shared primitive genuinely needs to change, say so and confirm before doing it.
4. Verify visually where possible (run the app, look at the screen) rather than reasoning about the markup alone.
5. `npm run typecheck` before calling it done.

## Data

The Supabase database is **live production**. Never mutate or delete real data, and never seed dummy records. Migrations: check `supabase migration list --linked` before any `db push`.

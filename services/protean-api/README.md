# protean-api

The dealership's only outbound path to Protean e-Sign Pro.

## Why this exists

Protean whitelists the IP address its callers arrive from. Supabase Edge Functions egress
from a shared pool with no stable address, so the Protean-facing code was carved out of
`project/supabase/functions/protean-*` into this service, which runs inside a VPC behind a
dedicated egress IP.

Nothing about the logic changed in the move. Callers still authenticate with their Supabase
access token, reads still go through a caller-scoped client so row-level security applies,
and the same role check gates every action.

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Liveness for the load balancer. No dependencies — it answers "is the process up", nothing more. |
| `POST` | `/esign` | Supabase JWT | Action-dispatched: `prepare_sale_agreement`, `stamp_options`, `initiate_esign`, `esign_status`, `cancel_esign`. |
| `POST` | `/lookup` | Supabase JWT | Vehicle / owner / insurance / challan lookups. |
| `POST` | `/webhook/protean` | HMAC `x-signature` | Inbound eSign Pro callbacks. |

Roles: `/esign` is owner, manager and sales executive; `/lookup` also allows accountant.
Both are enforced here *and* by RLS on the tables underneath.

## Running it

```bash
cp .env.example .env      # then fill it in
deno task dev             # or: deno task start

docker build -t protean-api .
docker run -p 8080:8080 --env-file .env protean-api
```

```bash
deno task test    # 54 tests, no network required
deno task check   # type-check the whole graph
```

## Deploying to the VPS

`./deploy.sh` copies the source, builds the image on the host, and starts the container.
Re-run it to redeploy — each step replaces what the last run left, so it is safe repeatedly.

```bash
cp .env.example .env    # fill it in first; the script refuses to run half-configured
./deploy.sh --host <ip> --key ../../project/hostinger-protean --domain esign.example.com
```

`--domain` adds a Caddy container that obtains and renews a Let's Encrypt certificate. It
is not optional in practice: the browser calls this service from an HTTPS page, and an
HTTPS page cannot call an HTTP endpoint. Point an A record at the host first.

The container publishes only to `127.0.0.1:8080`, so nothing reaches it except through the
proxy, and the env file is installed at `0600` over stdin rather than left in a temp file.
`./deploy.sh --help` lists the rest of the options.

## Deploying by hand

1. Build and push the image to whatever registry the VPC pulls from.
2. Set the environment from `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is the most
   sensitive value here — it bypasses RLS entirely. Use the platform's secret store, not a
   plain environment block, and keep it out of image layers and logs.
3. Give the service a **static egress IP** and register that address with Protean. This is
   the entire reason the service exists; without it, calls are rejected regardless of
   credentials.
4. Set `ALLOWED_ORIGINS` to the app's real origins. It falls back to `*` when unset, which
   is only defensible if the service cannot be reached from the public internet.
5. Point the app at it with `VITE_PROTEAN_API_URL` and rebuild the frontend.
6. In eSign Pro, set **Settings → eSign → Webhook** to
   `https://<this-service>/webhook/protean` with the same salt as
   `PROTEAN_WEBHOOK_SECRET`.

### Certificate

Protean's onboarding asks for a `.cer` upload alongside the IP whitelist. **Confirmed with
Protean (2026-08-04): it is a public certificate they use to verify or encrypt, not a
client certificate for mutual TLS.** Nothing in this service depends on it — outbound calls
are plain HTTPS with the header credentials in `src/protean/client.ts`, and there is no
`Deno.createHttpClient({ cert, key })` anywhere, deliberately.

Worth knowing if that ever changes: mutual TLS would need exactly that — `fetch` cannot
present a client certificate on its own — and it would be a contained change to
`client.ts` plus two secrets.

## Layout

```
src/
  main.ts              HTTP server, routing, CORS, error shaping
  config.ts            Service config: port, Supabase keys, allowed origins
  supabase.ts          Caller-scoped and service-role client factories
  auth.ts              Supabase JWT verification + org membership/role check
  routes/
    esign.ts           The five eSign actions
    lookup.ts          Registration-number lookups, with a cache window
    webhook.ts         Inbound callbacks, HMAC-verified
  protean/
    client.ts          e-Sign Pro HTTP client (verified against the vendor guide v1.8)
    config.ts          Protean credentials and hosts
    types.ts           Request/response shapes, transcribed from the guide
    esign-request.ts   Builds the masteresign payload; enforces the guide's validation
    agreement.ts       Renders the sale agreement PDF (no third-party dependency)
    sale-document.ts   Reads the sale, renders, stores, files it as a vehicle document
    status-map.ts      Protean's 22 statuses onto our six
    signing.ts         Webhook signature verification
    lookup-client.ts   The lookup product — NOT covered by the guide, still unverified
    http.ts            Error type and JSON responses
```

## What the guide pinned down

`docs/1777688745925.pdf` — "Protean e-Sign Pro - APIs" v1.8, 30 April 2026. The parts that
shaped this code:

- **Auth (§3)**: `apikey` and `Authorization: Bearer` headers, *plus* `emailOrMobile` and
  `password` in every request body. Nothing is signed.
- **One call (§4.3)**: `/api/v1/masteresign` carries the document, the eStamp and the
  signers together. eStamp is not a separate operation.
- **Validation (§4.4.1)**: document names are alphanumeric with single spaces; mobile
  numbers are bare ten-digit integers starting 6–9; emails lowercase; signer names capped
  at 50 each and 90 combined.
- **Statuses (§4.1, §4.2)**: 22 document states, 17 recipient states.
- **Webhook (§9)**: `x-signature`, HMAC-SHA256 over the JSON body, eight event types, and
  no referenceId — `documentId` is the only link back to a row. `Signed` fires per
  recipient, not per document.

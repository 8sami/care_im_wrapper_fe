# care_im_wrapper_fe — Demo VPS Setup

How the public demo is wired up, why it's wired that way, and how to rebuild it from scratch.
Written for someone who has never touched this box.

**No secrets in this doc.** Authtokens, WhatsApp credentials, and the Django secret key live on
the VPS only. Placeholders below look like `<...>`.

## 1. What's running

Three apps, two of them behind ngrok. Everything runs as `root` on a single Hetzner box.

| Piece               | Where                      | Port   | Managed by                             |
| ------------------- | -------------------------- | ------ | -------------------------------------- |
| care (Django)       | `/root/care`               | `9000` | `manage.py runserver_plus` (in Docker) |
| celery + redis + pg | `/root/care`               | —      | Docker (`scripts/celery-dev.sh`)       |
| care_fe             | `/root/care_fe`            | `4000` | pm2 → `frontend`                       |
| care_im_wrapper_fe  | `/root/care_im_wrapper_fe` | `4012` | pm2 → `wrapper-fe`                     |

Two ngrok tunnels, **on two different free accounts** (free tier allows one agent session per
account, which is the only reason there's more than one config file):

| Tunnel   | Public URL                          | → local | Started by                                                      |
| -------- | ----------------------------------- | ------- | --------------------------------------------------------------- |
| backend  | `https://<backend>.ngrok-free.dev`  | `:9000` | ngrok agent service (`~/.config/ngrok/ngrok.yml`)               |
| frontend | `https://<frontend>.ngrok-free.dev` | `:4000` | `nohup ngrok start --all --config ~/.config/ngrok/frontend.yml` |

**The plugin has no tunnel of its own.** care_fe proxies it — see §2.

```
browser ──▶ <frontend>.ngrok-free.dev ──▶ :4000 care_fe ──/plugin/──▶ :4012 care_im_wrapper_fe
       └──▶ <backend>.ngrok-free.dev  ──▶ :9000 care (Django)
```

## 2. Why the plugin is served under `/plugin/` and not its own tunnel

This is the important part. It looks like a detour; it isn't.

The plugin is a module-federation remote, so the **browser** fetches `remoteEntry.js` from
wherever the plugin is registered. Give the plugin its own ngrok domain and that fetch is
cross-origin, which runs into ngrok's free-tier browser warning page (`ERR_NGROK_6024`). That page
is served by ngrok's edge, returns **HTTP 200 with HTML and no CORS headers**, and never reaches
your app. Symptoms: `CORS header 'Access-Control-Allow-Origin' missing` on a 200, or
`blocked because of a disallowed MIME type ("text/html")`.

You can bypass the interstitial by sending `ngrok-skip-browser-warning: true` — but **only on
requests you control**. The federation runtime fetches `remoteEntry.js` itself, so no header can be
attached to it. `curl` appears to work (curl isn't browser-like, so the interstitial never fires),
which makes this very confusing to debug — **always test in a browser, not curl.**

Serving the plugin same-origin with care_fe sidesteps all of it: no interstitial (the page load
already cleared it), no CORS, no third ngrok account, and it stays compatible with care_fe's
`default-src 'self'` CSP (currently Report-Only).

## 3. The four patches this requires

Three live in **care_fe**, one here. None are upstream — they're demo-only fork edits, so expect
to re-apply them after a rebase.

### 3.1 `care_im_wrapper_fe/vite.config.mts` — serve under a sub-path

```ts
export default defineConfig({
  envPrefix: "REACT_",
  base: "/plugin/", // assets resolve under care_fe's /plugin/ prefix
  // ...
});
```

Without this, `remoteEntry.js` computes its CSS/chunk URLs against `/` and 404s once proxied.

### 3.2 `care_fe/vite.config.mts` — the proxy

```ts
    preview: {
      // ...existing headers/port...
      port: 4000,
      proxy: {
        "/plugin": {
          target: "http://localhost:4012",
          changeOrigin: true,
        },
      },
    },
```

Must go in the **`preview`** block, not `server` — pm2 runs `vite preview`, so `server` (used by
`npm run dev`) is never consulted. Preview config is read at process start: `pm2 restart frontend`
is enough, no rebuild needed.

### 3.3 `care_fe/src/i18n.ts` — don't discard the URL path

`namespaceToUrl()` originally did `return url.origin.toString()`, which assumes every plugin owns
its origin and keeps its locale at the root. Under `/plugin/` that fetches care_fe's _own_
`/locale/en.json` — returns **200 with the wrong strings**, so it fails silently rather than
erroring. Change to:

```ts
    const url = new URL(pluginConfig.meta.url);
    return url.href.replace(/\/assets\/remoteEntry\.js$/, "");
```

Backwards compatible: a plugin registered as `http://host/assets/remoteEntry.js` still resolves to
`http://host`, exactly as before. **Needs a rebuild** — it's app source, not config.

### 3.4 The ngrok header, on API calls (both frontends + Django)

Everything the plugin and care_fe fetch from the Django tunnel _is_ under our control, so:

- `care_fe/src/Utils/request/utils.ts` → in `makeHeaders()`
- `care_im_wrapper_fe/src/lib/request.ts` → in `getHeaders()`

```ts
headers.set("ngrok-skip-browser-warning", "true");
```

A custom header makes every request preflight, so Django must allow it —
`care/config/settings/base.py`:

```python
from corsheaders.defaults import default_headers

CORS_ALLOW_HEADERS = (*default_headers, "ngrok-skip-browser-warning")
```

`CSRF_TRUSTED_ORIGINS` is **not** a substitute for `CORS_ALLOWED_ORIGINS` — different settings,
different jobs. On `config.settings.deployment` there is no allow-all fallback (that only exists in
`config.settings.local`), so `CORS_ALLOWED_ORIGINS` must list the **frontend's** origin explicitly.

## 4. Registering the plugin

Admin → plugin config:

```json
{
  "url": "https://<frontend>.ngrok-free.dev/plugin/assets/remoteEntry.js",
  "name": "care_im_wrapper",
  "config": {}
}
```

`name` must stay `care_im_wrapper` — it's the federation remote name from `vite.config.mts` and the
i18n namespace, not a free-text label.

Note this is **care_fe's** domain, with a `/plugin/` path — not the plugin's port.

## 5. Rebuilding it from scratch

Assumes Node ≥22, Docker, pm2, and the ngrok agent installed; repos cloned to `/root/`.

```bash
# 1. ngrok: one config per account. Pin static domains (url:) or they change every restart.
ngrok config add-authtoken <backend-token>                                    # ~/.config/ngrok/ngrok.yml
ngrok config add-authtoken <frontend-token> --config ~/.config/ngrok/frontend.yml

# frontend.yml:
#   version: "3"
#   agent: { authtoken: <token> }
#   endpoints:
#     - name: care_fe
#       url: https://<frontend>.ngrok-free.dev     # omit and you get a random name each restart
#       upstream: { url: 4000 }

sudo ngrok service install --config /root/.config/ngrok/ngrok.yml && sudo ngrok service start
nohup ngrok start --all --config ~/.config/ngrok/frontend.yml > ~/ngrok-frontend.log 2>&1 &

# 2. Apply the four patches from §3.

# 3. Point care_fe at the backend tunnel (care_fe/.env.local):
#   REACT_CARE_API_URL=https://<backend>.ngrok-free.dev

# 4. Build + serve. preview serves dist/ — a build is mandatory, restarts alone do nothing.
cd /root/care_im_wrapper_fe && npm ci && npm run build
pm2 start npm --name wrapper-fe -- run preview -- --port 4012 --host

cd /root/care_fe && npm ci && npm run build
pm2 start npm --name frontend -- run preview -- --port 4000 --host

pm2 save    # survives reboot

# 5. Register the plugin (§4), then hard-refresh.
```

Verify each hop before blaming the next one:

```bash
curl -sI http://localhost:4012/plugin/assets/remoteEntry.js | head -3   # plugin direct
curl -sI http://localhost:4000/plugin/assets/remoteEntry.js | head -3   # through the proxy
curl -sI http://localhost:4000/plugin/locale/en.json | head -3          # translations
```

All three want `200`; the first two want `content-type: text/javascript`. `text/html` means the
proxy didn't match and care_fe's SPA fallback answered.

## 6. Day-to-day

```bash
pm2 status
pm2 logs wrapper-fe --lines 50

# after editing plugin source
cd /root/care_im_wrapper_fe && npm run build && pm2 restart wrapper-fe

# after editing care_fe source
cd /root/care_fe && npm run build && pm2 restart frontend

# after editing only care_fe's vite preview config
pm2 restart frontend
```

**Never `pkill -f vite`** — it matches pm2's own children and kills both apps. Kill strays by
explicit PID (`ps -eo pid,ppid,cmd | grep vite`); anything parented by the pm2 daemon is legitimate.

Django and celery auto-reload on `*.py` changes (`runserver_plus`, `watchmedo`), so backend edits
need no restart. `.env` changes **do** — env vars are read once at process start.

## 7. Traps, and what they look like

| Symptom                                                                         | Cause                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS 'Access-Control-Allow-Origin' missing`, status **200**                    | ngrok interstitial, not CORS. See §2.                                                                                                                            |
| `curl` returns JSON but the browser 'CORS-fails' the same URL                   | curl isn't browser-like; the interstitial only fires for browsers.                                                                                               |
| `blocked because of a disallowed MIME type ("text/html")`                       | Interstitial HTML where JS was expected.                                                                                                                         |
| `ERR_NGROK_8012 ... connection refused`                                         | Tunnel is fine; nothing is listening on the upstream port. Check `pm2 status` and the `upstream.url` in the yml.                                                 |
| Plugin loads, but shows raw keys / care_fe's wording                            | §3.3 not applied — locale fetched from the wrong path, 200 with wrong content.                                                                                   |
| `npm run dev` exits immediately, ngrok says "server on localhost isn't running" | `care_fe`'s `dev` script short-circuits on `test -f src/pluginMap.ts` once that generated file exists. Use `npx vite`. Irrelevant here since pm2 runs `preview`. |
| Source edit has no effect                                                       | `preview` serves `dist/`. Rebuild.                                                                                                                               |
| Tunnel URL changed after a restart                                              | No `url:` pinned in the yml; re-register the plugin or pin the domain.                                                                                           |
| Django 405 on a plugin endpoint that exists in source                           | Backend plugin package on the box is older than your checkout. Pull/reinstall.                                                                                   |

CSP violations in the console are **Report-Only** — noisy, but nothing is being blocked.

## 8. Known rough edges

This is a demo box, not a deployment. Be aware:

- Django runs `runserver_plus` with `DJANGO_DEBUG=true` and permissive CORS on a **public URL**.
  Fine for a short demo; don't leave it up indefinitely, and never point it at real data.
- `plug_config.py` currently carries live WhatsApp credentials in source. They belong in env vars,
  and should be rotated if that repo is ever shared.
- care_fe's `vite-plugin-checker` is disabled on the box (`false && checker({...})`), so type and
  lint errors pass silently at build time. Local scaffolding — don't commit it.
- The `/root/*` checkouts and any local clones drift constantly. Check `git diff` on the box before
  assuming a fix is live.

## 9. File uploads (MinIO) — the third tunnel

File uploads (diagnostic report images, patient files, etc.) don't go through Django. The backend
returns a **presigned S3 URL** and the browser `PUT`s the bytes straight to MinIO. Out of the box
that URL points at `http://localhost:9100` — MinIO's host-mapped S3 port in care's
`docker-compose.yaml` (`9100:9000`). That host is only reachable *on the box*; from a real browser
`localhost:9100` means the **viewer's own machine**, over plain `http` from an `https` page. The
`PUT` dies before it leaves the browser.

Symptom: `POST /api/v1/files/` returns **200** (backend is fine, it minted the URL), then an XHR
`PUT http://localhost:9100/patient-bucket/...` shows **`status_code: 0`** — a network/mixed-content
failure, not a server error. A trailing Sentry `{"detail":"...rejected with_reason: Cors"} 403` is a
**red herring**: that's Sentry's ingest endpoint refusing the crash report, unrelated to the upload.

Fix = expose MinIO on its own tunnel and tell Django to sign URLs against the public host. **The
host is baked into the S3 signature at generation time**, so it has to be fixed on the backend — you
cannot rewrite it client-side without breaking the signature.

### 9.1 Third ngrok tunnel

Free tier is one agent per account, so this needs a **third** ngrok account (same reason §1 gives
for the second). Upstream is `9100`:

```yaml
# ~/.config/ngrok/bucket.yml
version: "3"
agent:
  authtoken: <bucket-token>
endpoints:
  - name: care_bucket
    url: https://<bucket>.ngrok-free.dev     # pin it, or it changes every restart
    upstream:
      url: 9100
```

```bash
nohup ngrok start --all --config ~/.config/ngrok/bucket.yml > ~/ngrok-bucket.log 2>&1 &
```

### 9.2 Point presigned URLs at the public host (care's deployment `.env`)

```bash
BUCKET_EXTERNAL_ENDPOINT=https://<bucket>.ngrok-free.dev
```

Set only the *external* endpoint — leave the internal `BUCKET_ENDPOINT` on `http://localhost:9100`
so the server→MinIO path stays local and fast. Both `FILE_UPLOAD_BUCKET_EXTERNAL_ENDPOINT` (patient
bucket, where `diagnostic_report` files land) and `FACILITY_S3_BUCKET_EXTERNAL_ENDPOINT` fall back
to this one var. `.env` is read once at start — **restart Django** (§6); a reload won't pick it up.

### 9.3 MinIO CORS (care's `docker-compose.yaml`)

The presigned `PUT` signs `content-type;host`, so the browser preflights it — MinIO must echo the
origin back or the `OPTIONS` fails even once the host is reachable. Add to the `minio` service's
`environment:` block and recreate the container:

```yaml
      MINIO_API_CORS_ALLOW_ORIGIN: https://<frontend>.ngrok-free.dev
```

```bash
docker compose up -d minio
```

### 9.4 If the PUT comes back 200-with-HTML

The upload `PUT` is a browser XHR through an ngrok free tunnel, so it can hit the **interstitial**
(§2) just like the plugin fetch. `ngrok-skip-browser-warning: true` is safe to add to that request —
it's not a signed header, so it won't break the signature — but it lives in **care_fe's**
file-upload util, so it's another §3.4-style demo-only fork patch. Wire up 9.1–9.3 first; only reach
for this if the `PUT` returns 200 with HTML instead of succeeding.

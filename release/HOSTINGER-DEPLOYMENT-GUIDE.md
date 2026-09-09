# Hostinger Deployment Guide — Digital Opus Engine

This is a manual, human-performed guide. Nothing in this pass created accounts, changed DNS, or uploaded anything — this environment has no Hostinger/FTP credentials. You (the user) perform every step below yourself.

**File to upload**: `release/digital-opus-engine-web.zip` (SHA-256 in `release/SHA256SUMS.txt`)

**Target**: `engine.digitalopusadsolutions.com` only. **Never** the existing `games.digitalopusadsolutions.com` — that is a separate, already-live site and must not be touched.

---

## A. Create or confirm the subdomain

1. Log in to Hostinger's control panel (hPanel).
2. Go to the domains/subdomains section for `digitalopusadsolutions.com`.
3. Check whether a subdomain named `engine` already exists.
   - If it does **not** exist, create a new subdomain: `engine.digitalopusadsolutions.com`. Hostinger will typically auto-create a document root folder for it (often something like `domains/digitalopusadsolutions.com/public_html/engine` or a dedicated `engine.digitalopusadsolutions.com` folder — the exact path varies by plan, so use whatever hPanel shows you rather than assuming).
   - If it already exists, proceed to step B and confirm what's currently in its document root before doing anything else.

## B. Determine the document root

1. In hPanel's File Manager (or via FTP/SFTP if you prefer), navigate to the subdomain's document root — hPanel's subdomain list normally shows this path directly next to the subdomain entry.
2. Note the exact path. Do not guess it — use what Hostinger displays.

## C. Back up any existing content (if the subdomain already had files)

1. If the document root is not empty, download or copy its current contents somewhere safe first (e.g. a local backup folder, or a "backup" subfolder outside the document root) before changing anything.
2. If the document root is empty or the subdomain is brand new, skip this step.

## D. Upload the ZIP

1. In File Manager, navigate into the subdomain's document root.
2. Upload `digital-opus-engine-web.zip` directly into that folder.

## E. Extract so `index.html` lands at the document root

1. Right-click the uploaded ZIP in File Manager and choose Extract (or equivalent).
2. **Verify** after extraction that `index.html` sits directly in the document root itself — e.g. `.../engine.digitalopusadsolutions.com/index.html`, not `.../engine.digitalopusadsolutions.com/digital-opus-engine-web/index.html`. This ZIP was built with a flat root structure specifically so extraction lands correctly without an extra nested folder — if your extractor tool creates a nested folder anyway, move the contents up one level so `index.html`, `editor/`, `games/`, `dist/`, `build/`, and `DEPLOYMENT-README.txt` all sit directly in the document root.

## F. Delete the uploaded ZIP afterward

1. Once extraction is confirmed correct, delete `digital-opus-engine-web.zip` from the document root (keep the extracted files only). Leaving the ZIP there is not harmful but is unnecessary clutter and unnecessary bandwidth if anyone requests it directly.

## G. Confirm HTTPS/SSL is active

1. In hPanel's SSL section, confirm an SSL certificate is issued and active for `engine.digitalopusadsolutions.com` (Hostinger typically auto-provisions free SSL for subdomains, but this can take a few minutes after subdomain creation).
2. If not yet active, wait for it to issue before testing, or force an SSL renewal/check from hPanel if it's stalled.

## H. Test the live URL

Open `https://engine.digitalopusadsolutions.com/` in a browser and confirm the Engine home page loads. Then follow `POST-DEPLOY-VERIFICATION.md` for the full checklist.

---

## DNS

Do not make any DNS changes preemptively. First check whether `https://engine.digitalopusadsolutions.com/` already resolves once the subdomain is created in hPanel — Hostinger usually auto-configures DNS for subdomains created through its own panel when the domain's nameservers point at Hostinger.

- If it already resolves correctly: no DNS change is needed.
- If it does not resolve after a reasonable wait (DNS propagation can take up to a few hours): check hPanel's DNS zone editor for the exact record it expects for `engine` (commonly a CNAME or A record it auto-suggests) and add only that exact record. **Never invent an A/CNAME target yourself, and never alter any other Digital Opus Ad Solutions DNS record** — especially never touch whatever record currently serves `games.digitalopusadsolutions.com`.

---

## Rollback (if something breaks after deployment)

- Only remove or revert files inside the `engine.digitalopusadsolutions.com` document root.
- If you took a backup in step C, restore it.
- Do **not** touch `games.digitalopusadsolutions.com` or its document root under any circumstances during rollback.
- Fix the issue locally in the `DOEngine` repository, rebuild (`node build/build.js` → `node tests/run-tests.js` → `node build/build-games.js` → `node build/build-engine-site.js`), regenerate the release ZIP, and re-upload following this guide again.

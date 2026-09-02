# Quacker Operations

Operational runbook for the Quacker production deployment.

## 1. Production environment

The production checkout is located at:

~~~text
/home/ubuntu/apps/quacker
~~~

The backend package is located at:

~~~text
/home/ubuntu/apps/quacker/server
~~~

The audited production runtime uses:

- Node.js 22.22.1
- Express 4.x
- PM2 for process management
- Nginx as the public reverse proxy
- systemd to manage the PM2 daemon

The application listens locally on:

~~~text
http://127.0.0.1:3000
~~~

Public traffic is served through:

~~~text
https://quacker.es
~~~

The production checkout should remain on the `main` branch.

Before performing operational changes, confirm the repository state:

~~~bash
cd /home/ubuntu/apps/quacker
git status --short --branch
~~~

A clean production checkout should not contain uncommitted application changes.

## 2. Application process — PM2

The backend runs under PM2 with the process name:

~~~text
quacker
~~~

The process runs in fork mode from:

~~~text
/home/ubuntu/apps/quacker/server/server.js
~~~

with the working directory:

~~~text
/home/ubuntu/apps/quacker/server
~~~

Check application status with:

~~~bash
pm2 status
~~~

or:

~~~bash
pm2 describe quacker
~~~

Restart Quacker after backend code or dependency changes with:

~~~bash
pm2 restart quacker
~~~

If environment variables have intentionally changed, use:

~~~bash
pm2 restart quacker --update-env
~~~

The PM2 daemon is managed by systemd through:

~~~text
pm2-ubuntu.service
~~~

Check its state with:

~~~bash
systemctl status pm2-ubuntu
~~~

The service should be enabled and active.

Persist the current PM2 process configuration with:

~~~bash
pm2 save
~~~

The saved PM2 dump is stored at:

~~~text
/home/ubuntu/.pm2/dump.pm2
~~~

and should remain readable only by the `ubuntu` user.

PM2 application logs use timestamps in the following format:

~~~text
YYYY-MM-DDTHH:mm:ssZ
~~~

Do not run a second independent PM2 daemon outside the systemd-managed service.

## 3. Reverse proxy and HTTPS — Nginx

Nginx exposes Quacker publicly and proxies requests to the local Node.js process.

The enabled site configuration is based on:

~~~text
/etc/nginx/sites-available/quacker.es
~~~

The configured hostnames are:

~~~text
quacker.es
www.quacker.es
~~~

Application traffic is proxied to:

~~~text
http://127.0.0.1:3000
~~~

The proxy configuration forwards the request host, client IP and protocol information through the standard headers used by Quacker.

Before applying any Nginx configuration change, validate the configuration:

~~~bash
sudo nginx -t
~~~

Only reload Nginx after a successful validation:

~~~bash
sudo systemctl reload nginx
~~~

Check the service state with:

~~~bash
systemctl status nginx
~~~

Nginx should remain enabled and active.

HTTP requests are redirected to HTTPS.

TLS certificates are managed by Certbot for:

~~~text
quacker.es
www.quacker.es
~~~

Check installed certificates with:

~~~bash
sudo certbot certificates
~~~

Certificate renewal is handled through the systemd Certbot timer.

Check its state with:

~~~bash
systemctl status certbot.timer
~~~

A renewal simulation can be performed with:

~~~bash
sudo certbot renew --dry-run
~~~

The production site sends HSTS with:

~~~text
Strict-Transport-Security: max-age=86400
~~~

The application also sends its Content Security Policy and other security headers through the backend.

A quick public HTTPS check can be performed with:

~~~bash
curl -sS -o /dev/null -w 'HTTP %{http_code} · %{time_total}s\n' https://quacker.es/
~~~

A healthy public response should return HTTP 200.

Inspect security-related response headers with:

~~~bash
curl -sSI https://quacker.es/ | grep -iE '^(content-security-policy|strict-transport-security):'
~~~

## 4. Data persistence

Quacker currently persists application data in:

~~~text
/home/ubuntu/apps/quacker/server/db.json
~~~

The database is a JSON file managed by the backend.

Database writes use an atomic write strategy: data is written to a temporary file and then renamed into place.

After a successful write, `db.json` is forced to permissions:

~~~text
0600
~~~

This means the database should only be readable and writable by its owner.

Do not edit `db.json` manually while Quacker is running.

Before any manual database operation, verify that the intended file belongs to the production checkout and preserve the existing data.

## 5. Database backups

Quacker creates rotating backups of the JSON database before protected database writes.

Backup files are stored beside `db.json` and use the prefix:

~~~text
db.json.backup-
~~~

A backup name follows this general pattern:

~~~text
db.json.backup-<timestamp>-<random>
~~~

Backup files are forced to permissions:

~~~text
0600
~~~

Quacker keeps a maximum of five backups in the protected backup flow.

List the backups recognized by the restoration CLI with:

~~~bash
cd /home/ubuntu/apps/quacker/server
npm run db:restore -- --list
~~~

The command prints backups from newest to oldest together with their size and modification timestamp.

If no backups are available, it prints:

~~~text
No hay backups disponibles.
~~~

The restoration system only recognizes backups located in the same directory as `db.json` and whose filename starts with the expected `db.json.backup-` prefix.

Non-regular files are not accepted as valid backups.

## 6. Database restoration

Database restoration is exposed through the npm script:

~~~text
db:restore
~~~

Always inspect the available backups first:

~~~bash
cd /home/ubuntu/apps/quacker/server
npm run db:restore -- --list
~~~

A restore requires both the backup name and explicit confirmation:

~~~bash
npm run db:restore -- --restore <backup-name> --confirm
~~~

For example:

~~~bash
npm run db:restore -- --restore db.json.backup-<timestamp>-<random> --confirm
~~~

Without `--confirm`, the CLI refuses to restore the database.

Before replacing `db.json`, the selected backup is:

- resolved inside the database directory
- checked for the expected backup filename prefix
- checked to ensure it is a regular file
- parsed as JSON
- validated against the Quacker database schema

If any of these checks fail, the restoration is aborted.

A successful restoration also preserves the database that existed immediately before the restore as another rotating backup.

For an operational restore, stop application writes before replacing the database:

~~~bash
pm2 stop quacker
~~~

List and restore the intended backup, then start the application again:

~~~bash
pm2 restart quacker
~~~

After restoration, confirm that Quacker starts normally and perform the health checks described later in this document.

Never restore an arbitrary JSON file by renaming it to look like a Quacker backup without first verifying its contents and origin.

## 7. Sensitive files and permissions

Quacker contains several files that must not be publicly readable or committed to Git.

The production environment file is:

~~~text
/home/ubuntu/apps/quacker/.env
~~~

Expected permissions:

~~~text
0600
~~~

The production database is:

~~~text
/home/ubuntu/apps/quacker/server/db.json
~~~

Expected permissions:

~~~text
0600
~~~

The session directory is:

~~~text
/home/ubuntu/apps/quacker/server/.sessions
~~~

Expected directory permissions:

~~~text
0700
~~~

Individual session files should use:

~~~text
0600
~~~

Database backups should also remain at:

~~~text
0600
~~~

Environment files, database data, backups and session files must remain ignored by Git.

The repository ignores environment variants with:

~~~text
.env
.env.*
~~~

while allowing the documentation template:

~~~text
!.env.example
~~~

Before committing changes, verify that sensitive files are not staged or tracked:

~~~bash
git status --short
git ls-files
~~~

Production requires a valid `SESSION_SECRET` of at least 32 characters.

The development fallback secret must not be used in production. If the production secret is invalid, Quacker should fail during startup rather than run with an insecure fallback.

## 8. Logs and log rotation

PM2 application logs are stored in:

~~~text
/home/ubuntu/.pm2/logs/quacker-out.log
/home/ubuntu/.pm2/logs/quacker-error.log
~~~

The active Quacker logs should remain restricted to the `ubuntu` user.

Inspect recent application output with:

~~~bash
tail -n 50 /home/ubuntu/.pm2/logs/quacker-out.log
~~~

Inspect recent application errors with:

~~~bash
tail -n 50 /home/ubuntu/.pm2/logs/quacker-error.log
~~~

Quacker PM2 logs are rotated through:

~~~text
/etc/logrotate.d/quacker-pm2
~~~

The audited rotation policy is:

~~~text
daily
rotate 14
compress
delaycompress
missingok
notifempty
copytruncate
su ubuntu ubuntu
~~~

`copytruncate` allows the current PM2 process to continue writing without requiring an application restart during rotation.

Validate the Quacker logrotate rule without rotating logs:

~~~bash
sudo logrotate -d /etc/logrotate.d/quacker-pm2
~~~

The system logrotate timer should remain enabled and active:

~~~bash
systemctl status logrotate.timer
~~~

Nginx maintains its own access and error logs under:

~~~text
/var/log/nginx/
~~~

The audited Nginx log rotation is daily, retains 14 rotations, compresses old logs and recreates active logs with restricted permissions.

PM2 output uses timestamps so that application events can be correlated with Nginx and system logs.

## 9. Dependency maintenance

Backend dependencies are managed from:

~~~text
/home/ubuntu/apps/quacker/server
~~~

Install the exact dependency versions recorded in `package-lock.json` with:

~~~bash
npm ci
~~~

Check known dependency vulnerabilities with:

~~~bash
npm audit
~~~

Check available dependency updates with:

~~~bash
npm outdated
~~~

Dependency upgrades should be performed in a separate branch or worktree and validated before they reach `main`.

After dependency changes, run the complete backend test suite:

~~~bash
npm test
~~~

A dependency change is not considered ready until the test suite passes and `npm audit` has been reviewed.

Quacker currently remains on Express 4.x. A future Express 5 upgrade should be treated as a dedicated major-version migration rather than mixed into routine dependency maintenance.

The current dependency tree includes an npm override for `qs` so that the application uses the patched 6.16.0 release while remaining on Express 4.x.

Verify the installed dependency tree when necessary with:

~~~bash
npm ls express body-parser qs --all
~~~

## 10. Updating the production checkout

Production runs from the `main` branch.

Before updating, confirm that the checkout is clean:

~~~bash
cd /home/ubuntu/apps/quacker
git status --short --branch
~~~

Update `main` without creating an unexpected merge commit:

~~~bash
git pull --ff-only origin main
~~~

If backend dependencies or the lockfile changed, synchronize the installed packages:

~~~bash
cd /home/ubuntu/apps/quacker/server
npm ci
~~~

Review the result of `npm audit` after installing dependencies.

Backend code or dependency changes require Quacker to be restarted:

~~~bash
pm2 restart quacker
~~~

If environment variables were intentionally changed, restart with:

~~~bash
pm2 restart quacker --update-env
~~~

Frontend-only or test-only repository changes do not normally require a PM2 restart.

After any production update, perform the health checks below.

## 11. Health checks

Check that the PM2 process is online:

~~~bash
pm2 status
~~~

Inspect the latest application startup output:

~~~bash
tail -n 20 /home/ubuntu/.pm2/logs/quacker-out.log
~~~

Inspect recent backend errors:

~~~bash
tail -n 20 /home/ubuntu/.pm2/logs/quacker-error.log
~~~

Check the public HTTPS endpoint:

~~~bash
curl -sS -o /dev/null -w 'HTTP %{http_code} · %{time_total}s\n' https://quacker.es/
~~~

A healthy public response should return:

~~~text
HTTP 200
~~~

Inspect CSP and HSTS:

~~~bash
curl -sSI https://quacker.es/ | grep -iE '^(content-security-policy|strict-transport-security):'
~~~

For a broader infrastructure check, confirm that these systemd units are healthy:

~~~bash
systemctl status pm2-ubuntu
systemctl status nginx
systemctl status certbot.timer
systemctl status logrotate.timer
~~~

## 12. Incident diagnostics

When Quacker is unavailable, diagnose the problem from the inside out.

First check PM2:

~~~bash
pm2 status
pm2 describe quacker
~~~

Then inspect recent application logs:

~~~bash
tail -n 100 /home/ubuntu/.pm2/logs/quacker-out.log
tail -n 100 /home/ubuntu/.pm2/logs/quacker-error.log
~~~

Check whether the backend responds directly on localhost:

~~~bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/
~~~

If localhost works but the public site does not, inspect Nginx:

~~~bash
systemctl status nginx
sudo nginx -t
~~~

Then inspect Nginx logs:

~~~bash
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
~~~

If HTTPS or certificate renewal is involved, inspect Certbot:

~~~bash
systemctl status certbot.timer
sudo certbot certificates
~~~

If the PM2 daemon itself is unavailable, inspect:

~~~bash
systemctl status pm2-ubuntu
~~~

Avoid starting a separate PM2 daemon manually while diagnosing a systemd-managed PM2 service.

If an incident involves data, do not overwrite `db.json` manually. Inspect the available backups and use the validated restoration procedure from section 6.

## 13. Routine operational checklist

Use this checklist after deployments and during periodic maintenance:

- confirm the production checkout is clean and on `main`
- confirm `pm2-ubuntu.service` is enabled and active
- confirm the `quacker` PM2 process is online
- confirm Nginx is active
- confirm `https://quacker.es/` returns HTTP 200
- inspect recent PM2 error logs
- confirm CSP and HSTS are present
- review `npm audit`
- review `npm outdated`
- confirm `certbot.timer` is active
- periodically run `sudo certbot renew --dry-run`
- confirm `logrotate.timer` is active
- confirm sensitive file permissions remain restricted
- confirm database backups can be listed with the restoration CLI
- use the validated restore procedure rather than editing `db.json` manually

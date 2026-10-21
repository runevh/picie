# Production deployment

The host's Caddy service serves `https://picie.runevh.net` from
`/var/www/picie/current` and proxies `/api` and `/api/*` to the backend on
`127.0.0.1:7734`, preserving the `/api` prefix. Caddy handles HTTPS certificates.
PostgreSQL and the backend remain in Docker Compose. There is no frontend web
server container and no Nginx or Certbot dependency.

The device protocol on port 7735 is raw TCP, not HTTP. Its existing loopback
binding is unchanged; it is not routed through Caddy.

## One-time host setup

Install Caddy, Docker with Compose and Buildx, and `flock`. The `deploy` account
must have access to Docker and own `/srv/picie`. Keep the existing backend `.env`
and photos directory. Frontend `.env` files are included in the build context;
Vite variables are public build-time settings, never secrets. For same-origin
API requests, leave `VITE_API_URL` unset or set it to `/`.

As an administrator:

```sh
sudo install -d -o deploy -g deploy -m 755 /var/www/picie
sudo install -d -m 755 /etc/caddy/sites-enabled
sudo install -m 644 deploy/Caddyfile /etc/caddy/sites-enabled/picie.caddy
```

Add this line once at top level in `/etc/caddy/Caddyfile`, preserving all other
sites (including LifeStream):

```caddyfile
import /etc/caddy/sites-enabled/*.caddy
```

Build and publish the frontend as `deploy` before enabling the route:

```sh
cd /srv/picie
bash deploy/publish-frontend.sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

The final two commands require an administrator, not the deployment account.
DNS for `picie.runevh.net` must point to this host and ports 80/443 must reach
Caddy. Verify HTTPS, an SPA route, and `/api/auth` (401 when logged out).
Once verified, remove the old frontend container and disable/remove the old
Nginx and Certbot services/packages. Back up their configurations first and
check that other sites have also migrated. Do not delete database volumes.

## Routine deployment

The GitHub Actions workflow updates `/srv/picie`, builds/starts the backend and
database, then runs `deploy/publish-frontend.sh`. The script exports the Vite
build with Docker Buildx into a fresh release directory and atomically switches
the `current` symlink only after the build succeeds. No Caddy reload or sudo is
needed for frontend deployments. Releases are retained; remove older unused
releases periodically to reclaim disk space.

For a frontend-only deployment:

```sh
bash deploy/publish-frontend.sh
```

To roll back the frontend as `deploy`, substitute a retained release directory:

```sh
ln -s /var/www/picie/releases/RELEASE /var/www/picie/current.next
mv -Tf /var/www/picie/current.next /var/www/picie/current
```

When changing the Caddy snippet, an administrator must install it again,
validate the full Caddyfile, and reload Caddy. The routine workflow deliberately
does not overwrite the shared host configuration.

### Verified deployments

The production GitHub environment needs `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
and `VPS_HOST_FINGERPRINT`. Set the SHA256 host fingerprint using your hosting
console or an already trusted connection (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256`).
Do not obtain the trusted value from the workflow's network scan. Missing or
mismatched fingerprints stop deployment before SSH authentication.

The workflow deploys its exact commit SHA, even when `main` advances while it
waits. GitHub's public host key is pinned in `github-known-hosts`; update it only
from GitHub's published fingerprints if GitHub rotates that key. No trust-on-first-use
step runs on the server. Tests use disposable local Git repositories and SSH keys:
`python3 -m unittest discover -s tests -p deployment_test.py -v`.

#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
web_root=/var/www/picie

# The deployment account owns this directory; Caddy only needs read access.
test -d "$web_root" && test -w "$web_root" || {
  echo "Provision $web_root as described in deploy/README.md first." >&2
  exit 1
}
exec 9>"$web_root/.publish.lock"
flock 9
umask 022
mkdir -p "$web_root/releases"
release_dir="$(mktemp -d "$web_root/releases/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
docker buildx build --target static --output "type=local,dest=$release_dir" "$repo_dir/frontend"
test -s "$release_dir/index.html"
chmod -R a+rX "$release_dir"

# Publish only after a successful build. Retain releases for manual rollback.
ln -s "$release_dir" "$web_root/current.next"
mv -Tf "$web_root/current.next" "$web_root/current"
echo "Published frontend: $release_dir"

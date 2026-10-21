#!/usr/bin/env bash
set -euo pipefail
revision=${1:?Commit SHA is required}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 1; }
repo=${PICIE_REPO_DIR:-/srv/picie}
if [ ! -d "$repo/.git" ]; then
    git clone --no-checkout git@github.com:runevh/picie.git "$repo"
fi
cd "$repo"
git fetch origin "$revision"
[ "$(git rev-parse FETCH_HEAD)" = "$revision" ]
git checkout --detach --force "$revision"
[ "$(git rev-parse HEAD)" = "$revision" ]
docker compose -f docker-compose.prod.yml up -d --build db backend
bash deploy/publish-frontend.sh

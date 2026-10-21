#!/usr/bin/env bash
set -euo pipefail
keys=${1:?Known hosts file required}
expected=${2:?Trusted SHA256 fingerprint required}
[[ "$expected" == SHA256:* ]] || { echo 'Invalid SSH fingerprint' >&2; exit 1; }
# Accept only the independently trusted key, never other keys returned by the scan.
verified=$(mktemp)
trap 'rm -f "$verified"' EXIT
while IFS= read -r key; do
    [[ "$key" == \#* || -z "$key" ]] && continue
    fingerprint=$(printf '%s\n' "$key" | ssh-keygen -lf - -E sha256 | awk '{print $2}')
    if [ "$fingerprint" = "$expected" ]; then printf '%s\n' "$key" >> "$verified"; fi
done < "$keys"
[ -s "$verified" ] || { echo 'SSH host key does not match trusted fingerprint' >&2; exit 1; }
cat "$verified" > "$keys"

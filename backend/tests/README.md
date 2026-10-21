Image uploads accept single PNG, JPEG, or WebP images up to 8 MiB, 12 million
pixels, and 8192 pixels on either side. The JSON body limit also applies.
Images are normalized to the frame's 600×448 RGB layout before storage and
conversion. At most two conversions run concurrently; additional requests receive
503 and can be retried. Invalid images receive 400 before creating records/files.

`node scripts/test-runtime-install.js` verifies an isolated production install,
including the actual Sharp/native library versions, not just the npm manifest.
Minimum versions follow the upstream [Sharp security advisories](https://github.com/lovell/sharp/security/advisories).

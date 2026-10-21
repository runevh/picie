Image uploads accept single PNG, JPEG, or WebP images up to 8 MiB, 12 million
pixels, and 8192 pixels on either side. The JSON body limit also applies.
Images are normalized to the frame's 600×448 RGB layout before storage and
conversion. At most two conversions run concurrently; additional requests receive
503 and can be retried. Invalid images receive 400 before creating records/files.

`node scripts/test-runtime-install.js` verifies an isolated production install,
including the actual Sharp/native library versions, not just the npm manifest.
Minimum versions follow the upstream [Sharp security advisories](https://github.com/lovell/sharp/security/advisories).

`photoController.test.js` exercises controller responses with an isolated SQLite
database, real encryption, and temporary photo files. Image conversion is stubbed;
its behavior is covered separately in `imageProcessing.test.js`. The controller
tests cover upload failures, access checks, corrupt previews, and deletion recovery.

Run them from the repository root:

```sh
npm test --prefix backend -- --runInBand photoController
```

`pairingImage.test.js` uses real Sharp rendering and dithering to check the PIN's
layout, leading zeros, and packed display data. It checks pixel properties rather
than exact image snapshots so normal font-rendering differences are allowed.

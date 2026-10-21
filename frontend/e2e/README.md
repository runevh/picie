# End-to-end journeys

Install dependencies with `npm ci --prefix backend` and `npm ci --prefix frontend`,
install PostgreSQL 16 (add its `bin` directory to `PATH` or set `E2E_PG_BIN`),
then install Chromium with `cd frontend && npx playwright install --with-deps chromium`.
From the repository root, run:

```sh
npm run test:e2e --prefix frontend
```

Each test starts the real backend and Vite frontend on loopback addresses, with a
fresh PostgreSQL cluster on a private Unix socket, temporary photo storage, synthetic credentials,
and a TCP frame simulator. No deployment, existing `.env`, production account,
or physical frame is used. Processes and files are removed after each test.

The simulator authenticates, requests image chunks, and confirms receipt using
the frame protocol. Tests compare received pixels with stored photo data and
check that state advances only after confirmation. For pairing, the fixture
captures the PIN passed to the real image renderer and checks the received image
against its rendered pixels before entering the PIN in the browser.

Fixture IPC controls the clock, storage failure, and frame connection; it adds
no HTTP endpoints. An interrupted transfer is retried through the production
image manager. The periodic scheduler is disabled to keep tests deterministic.

Both desktop and mobile layouts cover registration, logout/login, pairing,
albums, upload, assignment, account isolation, and recovery from invalid/expired
pairing, offline frames, failed uploads, interrupted transfers, and expired login.
GitHub Actions runs the suite and uploads HTML reports, screenshots, traces, and
backend logs on failure. Local results are in `frontend/e2e-report` and
`frontend/e2e-results`.

These checks validate browser/backend/protocol integration, not production TLS, Wi-Fi provisioning, firmware timing, or a physical display.
A real-frame smoke test is still required for those hardware behaviors.

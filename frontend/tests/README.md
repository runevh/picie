# Browser and firmware checks

From the repository root:

```sh
(cd frontend && npm ci && npx playwright install chromium && npm test)
python3 -m unittest discover -s tests -p embedded_portal_test.py -v
pio test -d device -e native
pio run -d device -e esp12e
```

GitHub Actions runs these checks on PRs and main, alongside all backend tests.

Browser tests use synthetic API responses for the overview screens and execute
the real Wi-Fi portal, including credential submission. Native tests exercise the
same ArduinoJson serialization used by the device. Physical Wi-Fi provisioning
still needs a hardware smoke test; CI does not establish radio/device behavior.


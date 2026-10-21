# Wi-Fi setup and recovery

Connect the frame over USB and open a serial monitor at 115200 baud. Send
`WIFI_SETUP` followed by a newline. This works for initial setup and recovery;
failed Wi-Fi connections no longer open a hotspot automatically. An existing
connection attempt can delay command handling. During the identity prompt,
`WIFI_SETUP` is also accepted; device identity is provisioned separately.

The frame prints a unique `picie-setup-…` network name, a random hotspot password,
and a separate random setup code. Join that network, visit
`http://192.168.4.1`, enter the setup code, then scan or enter your home network.
Use a network name of 1–32 bytes and a password of 8–63 bytes. Spaces are
preserved. Open home networks are not supported.

The hotspot uses WPA2-PSK to protect the local provisioning connection. Both
secrets contain 128 random bits and change each session; neither is embedded
in the page or persisted. The HTTP server runs with station mode disabled.
Requests to scan or save require the setup code in a custom header, and no
cross-origin access is granted. Only a successful credential save permits a
restart; invalid, expired, and failed requests cannot restart the frame.

Setup closes after five minutes, or after a successful save and restart.
Requests do not extend that deadline. Send `WIFI_SETUP` over USB again to retry;
previous setup codes and hotspot passwords no longer work. Treat serial output
as sensitive, and do not publish session secrets. Anyone with physical serial
access is trusted to provision this device. HTTP is protected by the private
WPA2 connection, not TLS: do not share the session's hotspot password with others.

## Automated checks

- `pio test -d device -e native`: authorization, expiry including clock wrap,
  invalid credentials, failed-save retry, and single-use sessions.
- `pio run -d device -e esp12e`: compile the actual firmware and request handlers.
- `python -m unittest discover -s tests -p embedded_portal_test.py -v`:
  ensure the embedded portal matches its source.
- `cd frontend && npm test`: browser tests for both credential forms, error
  feedback, authorization headers, retries, and safe network names.

These checks already run in GitHub Actions.

## Hardware verification still required

On an isolated frame, verify that booting with missing or wrong Wi-Fi credentials
never opens an AP. Activate setup over USB; verify WPA2 is required and the printed
credentials work. Confirm requests with missing or wrong setup codes cannot scan,
write settings, or restart the frame. Try a successful first setup and recovery,
including exact network names containing spaces. Wait five minutes and confirm
the AP disappears without changing settings. Reopen setup and verify old secrets
fail. Confirm setup HTTP endpoints cannot be reached from the home network and
normal TLS/backend communication resumes after saving and rebooting.

Radio encryption, flash behavior, and physical reconnection have not been verified
by the simulated tests. Keep the hardware acceptance checks pending until run.

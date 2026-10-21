# Photo delivery confirmation

A scheduled photo remains pending until the current connection reports the image
transfer started (`0x41`), requests and receives the complete payload (`0x21`),
and reports idle (`0x40`). The existing firmware sends idle after its display
refresh completes. The backend tracks the active photo separately on the TCP
client; `currentPhotoId` remains the last confirmed photo during transfer.

All image writes, including pairing PIN images, use the device task queue.
Waiters are installed before writes so immediate replies cannot be lost.
Chunk requests must be nonzero and fit within the remaining payload. An error,
unexpected status, missing confirmation, or disconnect fails the operation and
closes the connection. Retries require a fresh connection, so old responses cannot
complete a new transfer. Generic idle outside an active transfer confirms nothing.
The transfer deadline is 90 seconds; ordinary photo chunk requests have a 30-second
limit. The queue also retains its overall 120-second task limit.

The sender rechecks photo access before sending and between chunks. Queue execution
uses the current album selection, not the selection captured when queued.
Confirmation rechecks ownership and selection before updating the displayed photo,
next photo, and next scheduled time in one conditional database update. Concurrent
state changes cause confirmation to fail rather than overwrite newer settings.
Failures leave the schedule due for the next scheduler tick (one minute); they do
not suppress a retry just because legacy state already names that photo as current.
Empty or cleared albums send no pixels. Existing records are not retroactively
proof that old deliveries succeeded; the next due transfer is sent again.

Run `cd backend && npm test -- --runInBand`. The delivery suite exercises the real
TCP parser and sender with simulated socket events, plus real disposable SQLite
models. It covers fragmented/immediate replies, premature or missing completion,
invalid chunks, disconnects, retries, pending state, selection changes, and schedule
races. Existing authorization tests cover revoked ownership and queued changes.
GitHub Actions discovers these tests automatically.

Hardware verification remains pending: perform a normal update, interrupt a
transfer, reconnect and confirm retry, change albums while queued, and compare
reported state with the actual display. This protocol trusts the authenticated
firmware's completion status; it cannot independently observe the physical screen.

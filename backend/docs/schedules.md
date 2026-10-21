# Schedule timezones

Time-of-day schedules store an IANA `timeZone` (for example `Europe/Brussels`).
New states default to UTC; the frame settings show the saved timezone and allow
it to be changed. Interval schedules still use elapsed minutes.

Before normal schema synchronization, startup adds the timezone column to an
existing DeviceStates table. It assigns the server's current IANA timezone to
existing schedules, preserving the old interpretation. Run the first upgrade
with the same server TZ configuration as the old version. The migration is
idempotent and never rewrites a saved timezone on later starts. Existing
next-update timestamps remain intact. Newly created states explicitly use UTC.

Timezone calculations use Temporal's `compatible` disambiguation: a missing
spring time moves forward by the clock gap, and a repeated autumn time runs at
its first occurrence only. For Brussels, 02:30 becomes 03:30 on the spring
transition day. After the first autumn 02:30 has passed, the next run is the
following day, not the second occurrence.

The browser displays the persisted zone and sends it with settings. It does not
calculate an alternative next run using the browser's local timezone.

Run `npm test -- --runInBand` in backend and `npm test` in frontend. Tests cover
server-zone independence, fractional offsets, midnight, both DST transitions,
persistence, invalid input, migration, and mobile/desktop settings.

See [Temporal's timezone rules](https://tc39.es/proposal-temporal/docs/timezone.html).

const { Temporal } = require('@js-temporal/polyfill');

function validateTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 100) {
        throw Object.assign(new Error('Choose a valid IANA timezone.'), { status: 400 });
    }
    try {
        new Intl.DateTimeFormat('en', { timeZone });
        return timeZone;
    } catch (error) {
        throw Object.assign(new Error('Choose a valid IANA timezone.'), { status: 400 });
    }
}

function nextTimeOfDay(times, timeZone, now = Date.now()) {
    validateTimeZone(timeZone);
    const today = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timeZone).toPlainDate();
    const candidates = [];
    for (let day = 0; day < 3; day++) {
        const date = today.add({ days: day });
        for (const time of times) {
            const [hour, minute] = time.split(':').map(Number);
            // Spring gaps move forward; repeated autumn times use the first occurrence only.
            const candidate = Temporal.ZonedDateTime.from({ timeZone, year: date.year, month: date.month,
                day: date.day, hour, minute }, { disambiguation: 'compatible' }).epochMilliseconds;
            if (candidate > now) candidates.push(candidate);
        }
    }
    return Math.min(...candidates);
}
module.exports = { validateTimeZone, nextTimeOfDay };

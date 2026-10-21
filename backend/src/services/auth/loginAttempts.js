const { createHash } = require('crypto');

// Process-local budgets. Restarting the server resets them.
function createLoginAttempts({ windowMs = 5 * 60 * 1000, maxEntries = 10000 } = {}) {
    const attempts = new Map();
    return function consume(keys) {
        const now = Date.now();
        for (const [key, entry] of attempts) {
            if (entry.expiresAt <= now) attempts.delete(key);
        }
        const entries = keys.map(([key, limit]) => {
            const hash = createHash('sha256').update(key).digest('hex');
            return { hash, limit, entry: attempts.get(hash) };
        });
        const blocked = entries.filter(({ entry, limit }) => entry && entry.count >= limit);
        if (blocked.length) {
            return Math.ceil((Math.max(...blocked.map(({ entry }) => entry.expiresAt)) - now) / 1000);
        }
        if (attempts.size + entries.filter(({ entry }) => !entry).length > maxEntries) {
            return Math.ceil(windowMs / 1000);
        }
        for (const { hash, entry } of entries) {
            if (entry) entry.count++;
            else attempts.set(hash, { count: 1, expiresAt: now + windowMs });
        }
        return 0;
    };
}
module.exports = { createLoginAttempts };

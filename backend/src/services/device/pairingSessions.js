const { randomInt, randomUUID } = require('crypto');

const SESSION_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 15 * 60 * 1000;
const fail = (status, message) => Object.assign(new Error(message), { status });

function createPairingSessions() {
    const sessions = new Map();
    const limits = new Map();

    function prune() {
        for (const [id, session] of sessions) {
            if (session.expiresAt <= Date.now()) sessions.delete(id);
        }
        for (const [key, limit] of limits) {
            if (limit.expiresAt <= Date.now()) limits.delete(key);
        }
    }

    function budgets(userId, id) {
        return [`user:${userId}`, `device:${id}`].map(key => {
            if (!limits.has(key)) {
                if (limits.size >= 10000) throw fail(503, 'Pairing is busy. Try again later.');
                limits.set(key, { starts: 0, guesses: 0, expiresAt: Date.now() + COOLDOWN_MS });
            }
            return limits.get(key);
        });
    }

    function checkLimits(entries) {
        const blocked = entries.filter(entry => entry.starts >= 5 || entry.guesses >= 3);
        if (blocked.length) {
            const seconds = Math.ceil((Math.max(...blocked.map(entry => entry.expiresAt)) - Date.now()) / 1000);
            throw fail(429, `Too many pairing attempts. Try again in ${seconds} seconds.`);
        }
    }

    function get(userId, id, sessionId) {
        prune();
        const session = sessions.get(id);
        if (!session || session.userId !== userId || session.sessionId !== sessionId) {
            throw fail(410, 'Pairing expired. Try again.');
        }
        return session;
    }

    function remove(session) {
        if (sessions.get(session.id) === session) sessions.delete(session.id);
    }

    return {
        begin(userId, id, deviceId) {
            prune();
            if (sessions.has(id) || [...sessions.values()].some(session => session.userId === userId)) {
                throw fail(409, 'A pairing session is already active. Cancel it or wait for it to expire.');
            }
            const entries = budgets(userId, id);
            checkLimits(entries);
            entries.forEach(entry => entry.starts++);
            const session = {
                userId, id, deviceId, sessionId: randomUUID(),
                pin: String(randomInt(10000)).padStart(4, '0'),
                expiresAt: Date.now() + SESSION_MS, state: 'displaying',
            };
            sessions.set(id, session);
            return session;
        },
        get,
        remove,
        claim(userId, id, sessionId, pin) {
            const session = get(userId, id, sessionId);
            if (session.state !== 'ready') throw fail(409, 'Pairing is busy. Please wait.');
            const entries = budgets(userId, id);
            // The fifth permitted start can still complete successfully.
            if (entries.some(entry => entry.guesses >= 3)) checkLimits(entries);
            if (typeof pin !== 'string' || pin !== session.pin) {
                entries.forEach(entry => entry.guesses++);
                if (entries.some(entry => entry.guesses >= 3)) {
                    remove(session);
                    checkLimits(entries);
                }
                throw fail(400, `Incorrect pairing code. ${3 - Math.max(...entries.map(entry => entry.guesses))} attempt(s) remaining.`);
            }
            session.state = 'completing';
            return session;
        },
        cancel(userId, id, sessionId) {
            const session = get(userId, id, sessionId);
            if (session.state === 'completing') throw fail(409, 'Pairing is being completed.');
            remove(session);
        },
    };
}

module.exports = { createPairingSessions, fail };

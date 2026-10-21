const { createPairingSessions } = require('../src/services/device/pairingSessions');
let store, now;
beforeEach(() => {
    now = 1000000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    store = createPairingSessions();
});
afterEach(() => jest.restoreAllMocks());
const begin = (user = 1, id = '123456') => {
    const session = store.begin(user, id, 'device-uuid');
    session.state = 'ready';
    return session;
};
const claim = (s, pin = s.pin) => store.claim(s.userId, s.id, s.sessionId, pin);

test('expires at five minutes and releases the frame', () => {
    const s = begin();
    now += 300000;
    expect(() => claim(s)).toThrow('expired');
    expect(begin(2).sessionId).not.toBe(s.sessionId);
});
test('reserves a frame during display and prevents competing starts', () => {
    store.begin(1, '123456', 'device');
    expect(() => begin(2)).toThrow('already active');
    expect(() => begin(1, '654321')).toThrow('already active');
});
test('binds completion and cancellation to user, device and session', () => {
    const s = begin();
    for (const args of [[2, s.id, s.sessionId], [1, '654321', s.sessionId], [1, s.id, 'stale']]) {
        expect(() => store.claim(...args, s.pin)).toThrow('expired');
        expect(() => store.cancel(...args)).toThrow('expired');
    }
    expect(claim(s)).toBe(s);
});
test('accepts only one completion and blocks cancellation while completing', () => {
    const s = begin();
    claim(s);
    expect(() => claim(s)).toThrow('busy');
    expect(() => store.cancel(1, s.id, s.sessionId)).toThrow('being completed');
});
test('guess limits survive restarts and apply to both user and device', () => {
    for (let i = 0; i < 3; i++) {
        const s = begin();
        expect(() => claim(s, 'invalid')).toThrow(i === 2 ? 'Too many' : 'Incorrect');
        store.remove(s);
    }
    expect(() => begin()).toThrow('Too many');
    expect(() => begin(2)).toThrow('Too many');
    expect(() => begin(1, '654321')).toThrow('Too many');
    now += 900000;
    expect(claim(begin())).toBeDefined();
});
test('limits starts but permits completion of the last allowed session', () => {
    for (let i = 0; i < 4; i++) {
        const s = begin();
        store.cancel(1, s.id, s.sessionId);
    }
    const s = begin();
    expect(claim(s)).toBe(s);
    store.remove(s);
    expect(() => begin()).toThrow('Too many');
});
test('old cleanup cannot remove a replacement session', () => {
    const old = begin();
    now += 300000;
    const current = begin();
    store.remove(old);
    expect(claim(current)).toBe(current);
});

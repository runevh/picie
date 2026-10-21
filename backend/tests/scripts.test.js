const fs = require('node:fs');
const childProcess = require('node:child_process');

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

const minimum = { sharp: '0.35.5', vips: '8.18.3', heif: '1.23.2', rsvg: '2.63.2' };
function checkRuntime(versions) {
    jest.isolateModules(() => {
        jest.doMock('sharp', () => ({ versions }));
        require('../scripts/check-image-runtime');
    });
}

test('image runtime accepts the supported versions', () => {
    expect(() => checkRuntime(minimum)).not.toThrow();
});
test('image runtime accepts newer minor and major versions', () => {
    expect(() => checkRuntime({ sharp: '1.0.0', vips: '8.19.0', heif: '2.0.0', rsvg: '2.64.0' })).not.toThrow();
});
test.each(Object.keys(minimum))('image runtime rejects outdated %s', library => {
    expect(() => checkRuntime({ ...minimum, [library]: '0.0.1' })).toThrow(`${library} 0.0.1 is below required`);
});
test.each(Object.keys(minimum))('image runtime rejects missing %s', library => {
    const versions = { ...minimum };
    delete versions[library];
    expect(() => checkRuntime(versions)).toThrow(`${library} missing`);
});

function summary(report, destination) {
    const previous = process.env.GITHUB_STEP_SUMMARY;
    if (destination) process.env.GITHUB_STEP_SUMMARY = destination;
    else delete process.env.GITHUB_STEP_SUMMARY;
    const output = { existsSync: jest.fn(() => report !== null),
        readFileSync: jest.fn(() => JSON.stringify(report)), appendFileSync: jest.fn() };
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        jest.isolateModules(() => {
            jest.doMock('fs', () => output);
            require('../scripts/test-summary');
        });
        return { text: destination ? output.appendFileSync.mock.calls[0][1] : write.mock.calls[0][0], output };
    } finally {
        write.mockRestore();
        if (previous === undefined) delete process.env.GITHUB_STEP_SUMMARY;
        else process.env.GITHUB_STEP_SUMMARY = previous;
    }
}
const report = { success: true, numPassedTests: 3, numFailedTests: 0, numPendingTests: 1, testResults: [] };

test('test summary explains a missing report', () => {
    const result = summary(null);
    expect(result.text).toContain('Tests did not produce a report');
    expect(result.output.readFileSync).not.toHaveBeenCalled();
});
test('test summary prints passed and skipped counts locally', () => {
    const { text } = summary(report);
    expect(text).toContain('**Passed** — 3 passed, 0 failed, 1 skipped.');
    expect(text).toContain('Scope: all backend Jest tests.');
    expect(text).not.toContain('Failed tests:');
});
test('test summary appends failures from every suite to GitHub output', () => {
    const { text, output } = summary({ ...report, success: false, numFailedTests: 2, testResults: [
        { assertionResults: [{ status: 'failed', fullName: 'first failure' }, { status: 'passed', fullName: 'passing test' }] },
        { assertionResults: [{ status: 'failed', fullName: 'second failure' }] },
    ] }, '/synthetic/summary.md');
    expect(text).toContain('**Failed** — 3 passed, 2 failed, 1 skipped.');
    expect(text).toContain('- first failure\n- second failure');
    expect(text).not.toContain('passing test');
    expect(output.appendFileSync).toHaveBeenCalledWith('/synthetic/summary.md', text);
});

// Keep filesystem staging real, but never launch npm or install packages here.
// CI separately executes this script against a real production installation.
test.each(['success', 'install failure', 'verification failure', 'copy failure'])(
    'production-install check cleans its temporary directory after %s', outcome => {
        const directories = [];
        const mkdtemp = fs.mkdtempSync.bind(fs);
        jest.spyOn(fs, 'mkdtempSync').mockImplementation(prefix => {
            const directory = mkdtemp(prefix);
            directories.push(directory);
            return directory;
        });
        const run = jest.spyOn(childProcess, 'execFileSync').mockImplementation((command, args, options) => {
            expect(fs.existsSync(`${options.cwd}/package-lock.json`)).toBe(true);
            expect(fs.existsSync(`${options.cwd}/check-image-runtime.js`)).toBe(true);
            if (outcome === 'install failure' && command === 'npm') throw Error('Installation failed');
            if (outcome === 'verification failure' && command === process.execPath) throw Error('Verification failed');
            return Buffer.alloc(0);
        });
        if (outcome === 'copy failure') jest.spyOn(fs, 'copyFileSync').mockImplementation(() => { throw Error('Copy failed'); });
        const execute = () => jest.isolateModules(() => require('../scripts/test-runtime-install'));
        try {
            if (outcome === 'success') {
                expect(execute).not.toThrow();
                expect(run).toHaveBeenNthCalledWith(1, 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'],
                    expect.objectContaining({ cwd: directories[0] }));
                expect(run).toHaveBeenNthCalledWith(2, process.execPath, expect.any(Array),
                    expect.objectContaining({ cwd: directories[0], env: expect.objectContaining({ NODE_PATH: '' }) }));
            } else {
                expect(execute).toThrow(/failed/);
                expect(run).toHaveBeenCalledTimes(outcome === 'copy failure' ? 0 : outcome === 'install failure' ? 1 : 2);
            }
            expect(directories).toHaveLength(1);
            expect(fs.existsSync(directories[0])).toBe(false);
        } finally {
            directories.forEach(directory => fs.rmSync(directory, { recursive: true, force: true }));
        }
    }
);

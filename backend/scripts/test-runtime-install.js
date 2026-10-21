const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const source = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'picie-runtime-'));
try {
    for (const file of ['package.json', 'package-lock.json']) {
        fs.copyFileSync(path.join(source, file), path.join(directory, file));
    }
    fs.copyFileSync(path.join(__dirname, 'check-image-runtime.js'), path.join(directory, 'check-image-runtime.js'));
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
    assert(manifest.dependencies.bcryptjs);
    assert(manifest.dependencies.uuid);
    assert(!manifest.devDependencies.bcryptjs);
    execFileSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' });
    execFileSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        const path = require('node:path');
        for (const name of ['bcryptjs', 'uuid']) {
            assert(require.resolve(name).startsWith(path.join(process.cwd(), 'node_modules') + path.sep));
        }
        assert.throws(() => require.resolve('jest'));
        require('./check-image-runtime.js');
        const bcrypt = require('bcryptjs');
        const { v4, validate, version } = require('uuid');
        const hash = bcrypt.hashSync('synthetic-runtime-password', 4);
        assert(bcrypt.compareSync('synthetic-runtime-password', hash));
        assert(!bcrypt.compareSync('wrong-password', hash));
        const id = v4();
        assert(validate(id));
        assert.equal(version(id), 4);
        console.log('Clean production install: password hashing and UUID generation passed.');
    `], { cwd: directory, env: { ...process.env, NODE_PATH: '' }, stdio: 'inherit' });
} finally {
    fs.rmSync(directory, { recursive: true, force: true });
}

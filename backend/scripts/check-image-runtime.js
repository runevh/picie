const assert = require('node:assert/strict');
const { versions } = require('sharp');
const versionNumber = value => value.split('.').map(Number).reduce((total, part) => total * 1000 + part, 0);
// Minimum native versions from the upstream Sharp security advisories.
const minimum = { sharp: '0.35.5', vips: '8.18.3', heif: '1.23.2', rsvg: '2.63.2' };
for (const [library, version] of Object.entries(minimum)) {
    assert(versions[library] && versionNumber(versions[library]) >= versionNumber(version),
        `${library} ${versions[library] || 'missing'} is below required ${version}`);
}
console.log('Image runtime:', Object.fromEntries(Object.keys(minimum).map(name => [name, versions[name]])));

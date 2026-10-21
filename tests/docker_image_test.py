"""Build isolated fixtures and inspect every layer; requires Docker."""
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
MARKER = b'PICIE_SYNTHETIC_PRIVATE_BUILD_FIXTURE_7f4182'


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()


class DockerImageTest(unittest.TestCase):
    def test_context_layers_and_runtime(self):
        name = 'picie-test-' + uuid.uuid4().hex[:12]
        containers = [name + '-app', name + '-db']
        images = [name + ':context', name + ':app']
        with tempfile.TemporaryDirectory() as directory:
            context = Path(directory) / 'context'
            context.mkdir()
            # Copy repository application files, never operational credentials/photos.
            tracked = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', 'backend'], cwd=ROOT, text=True).splitlines()
            for relative in tracked + ['backend/.dockerignore']:
                source = ROOT / relative
                part = source.relative_to(ROOT / 'backend')
                if part.parts[0] not in ('src', 'scripts', 'tests', 'Dockerfile', '.dockerignore', 'package.json', 'package-lock.json'):
                    continue
                if source.is_file():
                    target = context / source.relative_to(ROOT / 'backend')
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, target)
            for relative in ['.env', '.env.production', 'photos/private.png', 'node_modules/local-fixture',
                             'src/.env', 'src/tls/private.key', 'scripts/credentials.json',
                             'coverage/private-fixture', 'local-backup.sql']:
                target = context / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(MARKER)
            probe = Path(directory) / 'Context.Dockerfile'
            probe.write_text('FROM scratch\nCOPY . /context/\n')
            try:
                docker('build', '-q', '-f', str(probe), '-t', images[0], str(context))
                docker('build', '-q', '-t', images[1], str(context))
                for index, image in enumerate(images):
                    archive = Path(directory) / f'image-{index}.tar'
                    docker('save', '-o', str(archive), image)
                    with tarfile.open(archive) as saved:
                        manifest = json.load(saved.extractfile('manifest.json'))
                        for layer in manifest[0]['Layers']:
                            with tarfile.open(fileobj=saved.extractfile(layer), mode='r|') as files:
                                for member in files:
                                    if member.isfile():
                                        stream = files.extractfile(member)
                                        previous = b''
                                        while chunk := stream.read(1024 * 1024):
                                            self.assertNotIn(MARKER, previous + chunk, member.name)
                                            previous = chunk[-len(MARKER):]
                docker('network', 'create', name)
                docker('volume', 'create', name)
                docker('run', '-d', '--name', containers[1], '--network', name, '--network-alias', 'db',
                       '-e', 'POSTGRES_USER=picie', '-e', 'POSTGRES_PASSWORD=synthetic-db-password',
                       '-e', 'POSTGRES_DB=picie', 'postgres:15')
                for _ in range(60):
                    if subprocess.call(['docker', 'exec', containers[1], 'pg_isready', '-U', 'picie'],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                        break
                    time.sleep(1)
                else:
                    self.fail('Disposable PostgreSQL did not become ready')
                docker('run', '-d', '--name', containers[0], '--network', name,
                       '-v', name + ':/app/photos', '-e', 'NODE_ENV=production',
                       '-e', 'POSTGRES_NAME=picie', '-e', 'POSTGRES_USER=picie',
                       '-e', 'POSTGRES_PASSWORD=synthetic-db-password',
                       '-e', 'JWT_SECRET=synthetic-jwt-secret', images[1])
                check = """const fs = require('fs');
                fetch('http://127.0.0.1:7734/api/register', {method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({username:'dockeruser',email:'docker@example.test',
                    firstName:'Docker',lastName:'Test',password:'synthetic-password'})})
                .then(async r => { if(r.status !== 200) throw Error(await r.text());
                  if(!r.headers.get('set-cookie')) throw Error('No session cookie');
                  fs.writeFileSync('/app/photos/runtime-test', 'runtime storage');
                }).catch(e => { console.error(e); process.exit(1); });"""
                # Wait only for readiness, then assert registration exactly once.
                ready = "fetch('http://127.0.0.1:7734/api/auth').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"
                for _ in range(60):
                    if subprocess.call(['docker', 'exec', containers[0], 'node', '-e', ready],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0:
                        break
                    time.sleep(1)
                else:
                    self.fail('Backend did not become ready: ' + docker('logs', containers[0]))
                docker('exec', containers[0], 'node', 'scripts/check-image-runtime.js')
                docker('exec', containers[0], 'node', '-e', check)
                self.assertEqual(docker('exec', containers[0], 'cat', '/app/photos/runtime-test'), 'runtime storage')
            finally:
                for container in containers:
                    subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                for command in [('network', 'rm', name), ('volume', 'rm', name), ('image', 'rm', *images)]:
                    subprocess.run(['docker', *command], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    unittest.main()

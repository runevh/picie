"""Exercise revision selection and host trust without contacting production."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def run(*args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, check=True, **kwargs).stdout.strip()


class DeploymentTests(unittest.TestCase):
    def test_deploys_requested_commit_even_after_main_advances(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, checkout, commands = root / 'source', root / 'checkout', root / 'bin'
            source.mkdir()
            commands.mkdir()
            run('git', 'init', '-b', 'main', str(source))
            run('git', '-C', str(source), 'config', 'user.email', 'test@example.test')
            run('git', '-C', str(source), 'config', 'user.name', 'Test')
            (source / 'deploy').mkdir()
            (source / 'deploy/publish-frontend.sh').write_text('git rev-parse HEAD > published\n')
            run('git', '-C', str(source), 'add', '.')
            run('git', '-C', str(source), 'commit', '-m', 'first')
            requested = run('git', '-C', str(source), 'rev-parse', 'HEAD')
            run('git', 'clone', str(source), str(checkout))
            (source / 'new-file').write_text('later revision')
            run('git', '-C', str(source), 'add', '.')
            run('git', '-C', str(source), 'commit', '-m', 'later')
            (commands / 'docker').write_text('#!/bin/sh\ngit rev-parse HEAD > built\n')
            (commands / 'docker').chmod(0o755)
            env = {**os.environ, 'PICIE_REPO_DIR': str(checkout), 'PATH': f'{commands}:{os.environ["PATH"]}'}
            run('bash', str(ROOT / 'deploy/remote.sh'), requested, env=env)
            self.assertEqual((checkout / 'built').read_text().strip(), requested)
            self.assertEqual((checkout / 'published').read_text().strip(), requested)
            self.assertFalse((checkout / 'new-file').exists())
            (checkout / 'built').unlink()
            failed = subprocess.run(['bash', str(ROOT / 'deploy/remote.sh'), '0' * 40], env=env, capture_output=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertFalse((checkout / 'built').exists())

    def test_requires_matching_trusted_host_key(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            keys = []
            for name in ['trusted', 'attacker']:
                key = root / name
                run('ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key))
                keys.append('example.test ' + key.with_suffix('.pub').read_text())
            fingerprint = run('ssh-keygen', '-lf', str(root / 'trusted.pub'), '-E', 'sha256').split()[1]
            hosts = root / 'known_hosts'
            hosts.write_text(''.join(keys))
            run('bash', str(ROOT / 'deploy/verify-host.sh'), str(hosts), fingerprint)
            self.assertEqual(hosts.read_text(), keys[0])
            hosts.write_text(keys[1])
            for expected in [fingerprint, '']:
                result = subprocess.run(['bash', str(ROOT / 'deploy/verify-host.sh'), str(hosts), expected], capture_output=True)
                self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()

"""Check the linked release artifact, rather than just looking for source strings."""
import os
from pathlib import Path
import subprocess
import unittest


class FirmwareSecurityTest(unittest.TestCase):
    def test_no_local_ota_service_but_backend_updates_remain(self):
        root = Path(__file__).resolve().parents[1]
        core = Path(os.environ.get('PLATFORMIO_CORE_DIR', Path.home() / '.platformio'))
        nm = core / 'packages/toolchain-xtensa/bin/xtensa-lx106-elf-nm'
        elf = root / 'device/.pio/build/esp12e/firmware.elf'
        symbols = subprocess.check_output([str(nm), '-C', str(elf)], text=True)
        self.assertNotIn('ArduinoOTA', symbols)
        self.assertIn('handle_incoming_firmware', symbols)


if __name__ == '__main__':
    unittest.main()

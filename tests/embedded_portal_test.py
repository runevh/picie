from pathlib import Path
import re
import unittest


class EmbeddedPortalTest(unittest.TestCase):
    def test_firmware_embeds_the_current_portal(self):
        root = Path(__file__).resolve().parents[1] / 'device/src'
        header = (root / 'page_html.h').read_text()
        data = bytes(int(value, 16) for value in re.findall(r'0x([0-9a-fA-F]{2})', header))
        self.assertEqual(data, (root / 'static/page.html').read_bytes())
        length = int(re.search(r'src_static_page_html_len = (\d+)', header).group(1))
        self.assertEqual(length, len(data))


if __name__ == '__main__':
    unittest.main()

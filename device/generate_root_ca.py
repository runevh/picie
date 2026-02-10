import os
from pathlib import Path

"""
Pre-build script for PlatformIO.

Reads ROOT_CA_CERT_FILE (path to PEM) or ROOT_CA_CERT (raw PEM string) from
.env (in project root) or environment and writes src/app/generated_root_ca.h
(gitignored).
"""


def load_dotenv(project_dir: Path):
    env_path = project_dir / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def read_cert_from_file(project_dir: Path, path_str: str) -> str:
    path = Path(path_str)
    if not path.is_absolute():
        path = project_dir / path
    return path.read_text()


def main():
    # Fallback to cwd if PROJECT_DIR not present (e.g., when __file__ is missing).
    project_dir = Path(os.environ.get("PROJECT_DIR", os.getcwd()))
    load_dotenv(project_dir)

    cert = os.getenv("ROOT_CA_CERT_FILE")
    if cert:
        pem = read_cert_from_file(project_dir, cert)
    else:
        pem = os.getenv("ROOT_CA_CERT", "")

    output_path = project_dir / "src" / "app" / "generated_root_ca.h"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        f.write(
            '#pragma once\n\n'
            'static const char *const ROOT_CA_CERT_PEM = R"EOF(\n'
            f'{pem.strip()}\n'
            ')EOF";\n'
        )


if __name__ == "__main__":
    main()

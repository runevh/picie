from pathlib import Path
import subprocess

project = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()
with (project / "src/page_html.h").open("wb") as output:
    subprocess.run(["xxd", "-i", "src/static/page.html"], cwd=project, stdout=output, check=True)

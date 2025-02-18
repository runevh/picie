import subprocess
import os

print("Running the script...")


def generate_html_header(input_file, output_file):
    command = ['xxd', '-i', input_file, '>', output_file]
    subprocess.run(' '.join(command), shell=True)

input_html = "src/static/page.html"
output_header = "src/page_html.h"

generate_html_header(input_html, output_header)
print(f"Generated {output_header} from {input_html}")

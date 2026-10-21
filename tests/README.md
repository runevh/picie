# Docker regression check

Run `python3 -m unittest discover -s tests -p docker_image_test.py -v` from the repository root. GitHub Actions runs this check on PRs and main.

The Docker test requires a running Docker daemon. It uses synthetic secrets and
photos, inspects every saved layer of both a build-context probe and the runtime
image, and checks registration and mounted storage with disposable PostgreSQL.
It removes only its own containers, network, volume, and image tags. It does not
audit previously deployed images or production caches; those need a separate
inspection before considering historical exposure resolved.


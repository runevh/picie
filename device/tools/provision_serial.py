#!/usr/bin/env python3
"""
Simple one-shot provisioning helper for the device's serial flow.
Sends JSON with uuid/key to the device bootloader prompt and prints feedback.

Requires: pyserial (`pip install pyserial`)
Usage: python provision_serial.py --port /dev/ttyUSB0 --uuid abc --key secret
If uuid/key are omitted, you will be prompted interactively.
"""

import argparse
import json
import sys
import time

try:
    import serial
    from serial import SerialException
except ImportError as exc:
    sys.stderr.write("pyserial is required. Install with: pip install pyserial\n")
    raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Provision device UUID/key over serial")
    parser.add_argument("--port", required=True, help="Serial port (e.g., /dev/ttyUSB0, /dev/cu.usbserial-1410, COM5)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default: 115200)")
    parser.add_argument("--uuid", help="Device UUID")
    parser.add_argument("--key", help="Device key/secret")
    parser.add_argument("--wait", type=float, default=2.0, help="Seconds to wait after opening port before sending (default: 2)")
    parser.add_argument("--read-timeout", type=float, default=0.5, help="Serial read timeout in seconds (default: 0.5)")
    parser.add_argument("--listen-seconds", type=float, default=5.0, help="Seconds to keep reading feedback after sending (default: 5)")
    return parser.parse_args()


def prompt_missing(value: str, label: str) -> str:
    if value:
        return value
    return input(f"Enter {label}: ").strip()


def main() -> int:
    args = parse_args()
    uuid = prompt_missing(args.uuid, "UUID")
    key = prompt_missing(args.key, "key")

    if not uuid or not key:
        sys.stderr.write("Both uuid and key are required.\n")
        return 1

    payload = json.dumps({"uuid": uuid, "key": key}) + "\n"

    try:
        ser = serial.Serial(args.port, baudrate=args.baud, timeout=args.read_timeout)
    except SerialException as exc:
        sys.stderr.write(f"Failed to open {args.port}: {exc}\n")
        return 1

    with ser:
        # Give the device a moment after reset/connection to print its prompt.
        time.sleep(max(args.wait, 0))

        sys.stdout.write(f"Sending provisioning payload to {args.port}...\n")
        ser.write(payload.encode("utf-8"))
        ser.flush()

        # Read back a few lines for confirmation.
        end_time = time.time() + max(args.listen_seconds, 0)
        while time.time() < end_time:
            if ser.in_waiting:
                try:
                    line = ser.readline().decode(errors="ignore").strip()
                except SerialException as exc:
                    sys.stderr.write(f"Serial read error: {exc}\n")
                    break
                if line:
                    sys.stdout.write(f"[device] {line}\n")
            else:
                time.sleep(0.05)

    sys.stdout.write("Done. If you saw 'UUID and key stored. Rebooting...', provisioning succeeded.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

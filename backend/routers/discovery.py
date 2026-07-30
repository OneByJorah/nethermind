"""System discovery endpoints.

Auto-detect serial ports, USB devices, and network interfaces
connected to the host machine.
"""
import os
import re
import subprocess
import logging

from fastapi import APIRouter

from services.serial_client import list_available_ports

router = APIRouter(prefix="/api/system", tags=["system"])
logger = logging.getLogger(__name__)


def _parse_lsusb() -> list[dict]:
    """Parse lsusb output into structured device list."""
    devices = []
    try:
        result = subprocess.run(["lsusb"], capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            return devices
        for line in result.stdout.strip().split("\n"):
            m = re.match(r'Bus (\d+) Device (\d+): ID ([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\s+(.*)', line)
            if m:
                devices.append({
                    "bus": int(m.group(1)),
                    "device": int(m.group(2)),
                    "vendor_id": m.group(3),
                    "product_id": m.group(4),
                    "description": m.group(5).strip(),
                })
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.warning(f"lsusb failed: {e}")
    return devices


def _parse_usb_serial_devices() -> list[dict]:
    """Detect USB-to-serial adapters from sysfs and dmesg."""
    devices = []
    for dev in os.listdir("/dev"):
        full = os.path.join("/dev", dev)
        if dev.startswith("ttyUSB") or dev.startswith("ttyACM"):
            info = {"device": full, "name": dev, "type": "usb_serial"}
            try:
                real = os.path.realpath(f"/sys/class/tty/{dev}/device")
                if "usb" in real:
                    parts = real.split("/")
                    for i, p in enumerate(parts):
                        if p == "usb":
                            info["usb_path"] = "/".join(parts[i:i+4])
                            break
            except OSError:
                pass
            devices.append(info)

    try:
        result = subprocess.run(
            ["dmesg"], capture_output=True, text=True, timeout=3
        )
        for line in result.stdout.split("\n"):
            if "usb" in line.lower() and ("ttyUSB" in line or "ttyACM" in line):
                devices.append({
                    "device": "dmesg",
                    "name": "detected",
                    "type": "dmesg_hint",
                    "message": line.strip(),
                })
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    return devices


@router.get("/serial-ports")
def get_serial_ports():
    """List all available serial/COM ports with metadata."""
    return list_available_ports()


@router.get("/usb-devices")
def get_usb_devices():
    """List all detected USB devices on the system."""
    return _parse_lsusb()


@router.get("/discovery")
def get_discovery():
    """Full hardware discovery: serial ports, USB devices, USB-serial adapters."""
    return {
        "serial_ports": list_available_ports(),
        "usb_devices": _parse_lsusb(),
        "usb_serial_adapters": _parse_usb_serial_devices(),
    }

"""Serial COM port client for console access to network switches.

Supports connecting to switches via serial console cable (USB-to-serial,
RS-232, etc.) for out-of-band management, initial provisioning, and
recovery scenarios where SSH is not available.
"""
import re
import time
import hashlib
import logging
from typing import Optional

import serial
from serial.tools import list_ports

from config import settings
from database import SessionLocal
from models import Switch, ConfigBackup, AuditLog, DeviceMetric

logger = logging.getLogger(__name__)

# Default serial parameters
DEFAULT_BAUD = 9600
DEFAULT_DATABITS = 8
DEFAULT_PARITY = "N"  # N, E, O
DEFAULT_STOPBITS = 1
DEFAULT_TIMEOUT = 10
DEFAULT_CONSOLE_PROMPT = b">"
DEFAULT_ENABLE_PROMPT = b"#"
DEFAULT_LOGIN_PROMPT = b"Username:"
DEFAULT_PASSWORD_PROMPT = b"Password:"


def list_available_ports() -> list[dict]:
    """List all available serial ports on the system."""
    ports = []
    for port in list_ports.comports():
        ports.append({
            "device": port.device,
            "description": port.description,
            "manufacturer": port.manufacturer,
            "hwid": port.hwid,
        })
    return ports


def _build_serial_params(switch: Switch) -> dict:
    """Build serial connection parameters from a Switch model."""
    return {
        "port": switch.serial_port or "/dev/ttyUSB0",
        "baudrate": switch.serial_baud or DEFAULT_BAUD,
        "bytesize": switch.serial_databits or DEFAULT_DATABITS,
        "parity": switch.serial_parity or DEFAULT_PARITY,
        "stopbits": switch.serial_stopbits or DEFAULT_STOPBITS,
        "timeout": switch.serial_timeout or DEFAULT_TIMEOUT,
        "xonxoff": False,
        "rtscts": False,
    }


def _log_audit(action: str, target_type: str, target_id: int, status: str = "success", details: dict = None):
    """Write an immutable audit log entry."""
    db = SessionLocal()
    try:
        db.add(AuditLog(
            action=action, actor="system", target_type=target_type,
            target_id=target_id, status=status, details=details or {}
        ))
        db.commit()
    finally:
        db.close()


def _open_serial_connection(switch: Switch) -> serial.Serial:
    """Open a serial connection to the switch console port."""
    params = _build_serial_params(switch)
    logger.info(f"Opening serial connection: {params['port']} @ {params['baudrate']} baud")
    conn = serial.Serial(**params)
    # Give the device a moment to initialize
    time.sleep(2)
    # Flush any boot-up output
    conn.reset_input_buffer()
    return conn


def _send_command_serial(conn: serial.Serial, command: str, prompt: bytes = b"#",
                         read_timeout: float = 3.0) -> str:
    """Send a command over serial and read the response until the prompt appears."""
    # Send the command
    conn.write((command + "\n").encode())
    time.sleep(0.5)

    # Read until we see the prompt or timeout
    output = b""
    deadline = time.time() + read_timeout
    while time.time() < deadline:
        if conn.in_waiting:
            chunk = conn.read(conn.in_waiting)
            output += chunk
            # Check if we have the prompt at the end
            if prompt in output:
                break
        else:
            time.sleep(0.1)

    # Decode, stripping non-printable chars
    result = output.decode("utf-8", errors="replace")
    # Remove echo of the command itself from output
    lines = result.splitlines()
    filtered = []
    for line in lines:
        if line.strip() == command.strip():
            continue
        filtered.append(line)
    return "\n".join(filtered)


def _enter_enable_mode(conn: serial.Serial, switch: Switch) -> bool:
    """Enter privileged EXEC mode over serial."""
    try:
        conn.write(b"\n")
        time.sleep(0.5)
        conn.reset_input_buffer()

        # Send enable command
        conn.write(b"enable\n")
        time.sleep(1)

        # Check for password prompt
        output = b""
        deadline = time.time() + 5
        while time.time() < deadline:
            if conn.in_waiting:
                chunk = conn.read(conn.in_waiting)
                output += chunk
                if b"Password:" in output or b"password:" in output:
                    password = switch.serial_password or switch.ssh_password or settings.SSH_PASSWORD or ""
                    conn.write((password + "\n").encode())
                    time.sleep(1)
                    break
                if b"#" in output:
                    return True
            else:
                time.sleep(0.2)

        # Check if we got the enable prompt
        conn.reset_input_buffer()
        conn.write(b"\n")
        time.sleep(0.5)
        check = conn.read(conn.in_waiting)
        return b"#" in check
    except Exception as e:
        logger.warning(f"Failed to enter enable mode: {e}")
        return False


def pull_running_config_serial(switch_id: int) -> dict:
    """Pull running config from a switch via serial console."""
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": f"Switch {switch_id} not found"}

        conn = _open_serial_connection(switch)

        # Try to enter enable mode
        _enter_enable_mode(conn, switch)

        # Send terminal length 0 to disable paging
        _send_command_serial(conn, "terminal length 0", prompt=b"#")

        # Pull running config
        config = _send_command_serial(conn, "show running-config", prompt=b"#", read_timeout=15.0)

        # Get version info
        version = _send_command_serial(conn, "show version", prompt=b"#", read_timeout=10.0)

        conn.close()

        # Compute hash
        config_hash = hashlib.sha256(config.encode()).hexdigest()

        # Save config
        backup = ConfigBackup(
            switch_id=switch_id,
            config_type="running",
            running_config=config,
            config_hash=config_hash,
        )
        db.add(backup)

        # Parse version for Cisco
        if switch.vendor == "cisco_ios":
            for line in version.splitlines():
                if "Version" in line:
                    switch.os_version = line.strip()
                if "SN:" in line or "System Serial Number" in line:
                    m = re.search(r'(?:SN:|System Serial Number)\s*(\S+)', line)
                    if m:
                        switch.serial_number = m.group(1)

        # Update status
        switch.status = "online"
        db.commit()
        db.refresh(backup)

        _log_audit("config_backup_serial", "switch", switch_id, "success")
        return {"success": True, "backup_id": backup.id, "hostname": switch.hostname, "config_hash": config_hash}

    except serial.SerialException as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        _log_audit("config_backup_serial", "switch", switch_id, "failure", {"error": str(e)})
        return {"error": f"Serial connection failed: {e}"}
    except Exception as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        _log_audit("config_backup_serial", "switch", switch_id, "failure", {"error": str(e)})
        return {"error": str(e)}
    finally:
        db.close()


def check_health_serial(switch_id: int) -> dict:
    """Quick health check on a switch via serial console."""
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        conn = _open_serial_connection(switch)
        _enter_enable_mode(conn, switch)
        _send_command_serial(conn, "terminal length 0", prompt=b"#")

        health_output = _send_command_serial(conn, "show processes cpu | include CPU", prompt=b"#", read_timeout=8.0)
        version_output = _send_command_serial(conn, "show version", prompt=b"#", read_timeout=8.0)
        interface_output = _send_command_serial(conn, "show interfaces summary", prompt=b"#", read_timeout=8.0)

        conn.close()

        # Parse basic metrics
        cpu = None
        cpu_match = re.search(r'(\d+\.?\d*)%', health_output)
        if cpu_match:
            cpu = float(cpu_match.group(1))

        # Count interfaces
        intf_up = intf_down = 0
        for line in interface_output.splitlines():
            if "up" in line.lower() and ("protocol" in line.lower() or "status" in line.lower()):
                intf_up += 1
            elif "down" in line.lower() and ("protocol" in line.lower() or "status" in line.lower()):
                intf_down += 1

        metric = DeviceMetric(
            switch_id=switch_id,
            cpu_usage=cpu,
            interface_count=intf_up + intf_down,
            interfaces_up=intf_up,
            interfaces_down=intf_down,
        )
        db.add(metric)
        switch.status = "online"
        db.commit()

        return {
            "success": True,
            "hostname": switch.hostname,
            "cpu": cpu,
            "interfaces_up": intf_up,
            "interfaces_down": intf_down,
        }
    except Exception as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        return {"error": str(e)}
    finally:
        db.close()


def execute_commands_serial(switch_id: int, commands: list[str]) -> dict:
    """Execute commands on a switch via serial console."""
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        conn = _open_serial_connection(switch)
        _enter_enable_mode(conn, switch)
        _send_command_serial(conn, "terminal length 0", prompt=b"#")

        results = {}
        for cmd in commands:
            output = _send_command_serial(conn, cmd, prompt=b"#", read_timeout=10.0)
            results[cmd] = output

        conn.close()
        return {"success": True, "hostname": switch.hostname, "results": results}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


def push_config_serial(switch_id: int, config_commands: list[str]) -> dict:
    """Push configuration commands to a switch via serial console.

    This is a state-changing operation that should require human approval.
    """
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        conn = _open_serial_connection(switch)
        _enter_enable_mode(conn, switch)
        _send_command_serial(conn, "terminal length 0", prompt=b"#")

        # Enter config terminal mode
        _send_command_serial(conn, "configure terminal", prompt=b"(config)#", read_timeout=3.0)

        output_lines = []
        for cmd in config_commands:
            output = _send_command_serial(conn, cmd, prompt=b"(config)#", read_timeout=5.0)
            output_lines.append(f"# {cmd}\n{output}")

        # Exit config mode
        _send_command_serial(conn, "end", prompt=b"#", read_timeout=2.0)
        conn.close()

        result = "\n".join(output_lines)

        _log_audit("config_push_serial", "switch", switch_id, "success",
                   {"commands_count": len(config_commands)})
        return {"success": True, "output": result, "hostname": switch.hostname}
    except Exception as e:
        _log_audit("config_push_serial", "switch", switch_id, "failure", {"error": str(e)})
        return {"error": str(e)}
    finally:
        db.close()

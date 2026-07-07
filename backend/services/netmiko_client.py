"""Multi-vendor SSH client using Netmiko.

Supports Cisco IOS, Cisco XR, Juniper JunOS, Arista EOS, and Linux.
Handles config backup, config push, health check, and command execution.
"""
import os
import re
import hashlib
from typing import Optional
from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException

from config import settings
from database import SessionLocal
from models import Switch, ConfigBackup, AuditLog, DeviceMetric


VENDOR_MAP = {
    "cisco_ios": "cisco_ios",
    "cisco_xr": "cisco_xr",
    "juniper_junos": "juniper_junos",
    "arista_eos": "arista_eos",
    "linux": "linux",
    "cisco_nxos": "cisco_nxos",
    "cisco_asa": "cisco_asa",
    "huawei": "huawei",
    "extreme": "extreme",
    "mikrotik": "mikrotik_routeros",
    "ubiquiti": "ubiquiti_edgeos",
    "aruba_os": "hp_procurve",  # ArubaOS-Switch / ProVision
    "hp_procurve": "hp_procurve",
}


SHOW_COMMANDS = {
    "cisco_ios": {
        "running_config": "show running-config",
        "startup_config": "show startup-config",
        "version": "show version",
        "interfaces": "show interfaces summary",
        "ip_route": "show ip route",
        "vlan": "show vlan brief",
        "arp": "show ip arp",
        "mac": "show mac address-table",
        "health": "show processes cpu | include CPU",
        "memory": "show processes memory | include Processor",
        "logging": "show logging | last 50",
        "environment": "show environment",
        "inventory": "show inventory",
    },
    "cisco_xr": {
        "running_config": "show running-config",
        "version": "show version",
        "interfaces": "show interfaces brief",
        "ip_route": "show route",
        "health": "show processes cpu",
        "inventory": "show inventory",
    },
    "juniper_junos": {
        "running_config": "show configuration | display set",
        "version": "show version",
        "interfaces": "show interfaces terse",
        "ip_route": "show route",
        "health": "show system processes extensive | match cpu",
        "inventory": "show chassis hardware",
    },
    "arista_eos": {
        "running_config": "show running-config",
        "version": "show version",
        "interfaces": "show interfaces status",
        "ip_route": "show ip route",
        "health": "show processes top once",
        "inventory": "show inventory",
    },
    "linux": {
        "running_config": "cat /etc/netplan/*.yaml 2>/dev/null || ip addr show",
        "version": "uname -a",
        "interfaces": "ip -br addr show",
        "ip_route": "ip route show",
        "health": "top -bn1 | head -5",
        "memory": "free -m",
    },
    "aruba_os": {
        "running_config": "show running-config",
        "startup_config": "show startup-config",
        "version": "show version",
        "interfaces": "show interfaces brief",
        "ip_route": "show ip route",
        "vlan": "show vlan",
        "arp": "show arp",
        "mac": "show mac-address-table",
        "health": "show system",
        "memory": "show memory",
        "logging": "show logging",
        "environment": "show environment",
        "inventory": "show inventory",
        "trunk": "show trunk",
        "lacp": "show lacp",
        "spanning_tree": "show spanning-tree",
        "poe": "show power-over-ethernet",
        "lldp": "show lldp info remote-device",
    },
}


def _get_device_connection(switch: Switch) -> dict:
    """Build a Netmiko connection dict from a Switch model."""
    return {
        "device_type": VENDOR_MAP.get(switch.vendor, switch.vendor),
        "host": switch.ip_address,
        "username": switch.ssh_username or settings.SSH_USERNAME,
        "password": switch.ssh_password or settings.SSH_PASSWORD,
        "port": switch.ssh_port or 22,
        "timeout": settings.SSH_TIMEOUT,
        "global_delay_factor": 2,
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


def pull_running_config(switch_id: int) -> dict:
    """SSH into a switch, pull running config, store in DB, update status."""
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": f"Switch {switch_id} not found"}

        device_params = _get_device_connection(switch)
        conn = ConnectHandler(**device_params)
        conn.enable()

        # Get running config
        vendor_commands = SHOW_COMMANDS.get(switch.vendor, SHOW_COMMANDS["cisco_ios"])
        config = conn.send_command(vendor_commands["running_config"])

        # Get health info
        health = conn.send_command(vendor_commands.get("health", ""), delay_factor=2)

        # Get version
        version = conn.send_command(vendor_commands.get("version", ""), delay_factor=2)
        conn.disconnect()

        # Parse version & serial for Cisco
        if switch.vendor == "cisco_ios":
            for line in version.splitlines():
                if "Version" in line:
                    switch.os_version = line.strip()
                if "SN:" in line or "System Serial Number" in line:
                    m = re.search(r'(?:SN:|System Serial Number)\s*(\S+)', line)
                    if m:
                        switch.serial_number = m.group(1)

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

        # Parse CPU/memory for metrics
        cpu = None
        mem = None
        if "CPU" in health:
            import re
            cpu_match = re.search(r'(\d+\.?\d*)%', health)
            if cpu_match:
                cpu = float(cpu_match.group(1))

        # Record metric
        metric = DeviceMetric(
            switch_id=switch_id,
            cpu_usage=cpu,
            memory_usage=mem,
        )
        db.add(metric)

        # Update status
        switch.status = "online"
        db.commit()
        db.refresh(backup)

        _log_audit("config_backup", "switch", switch_id, "success")
        return {"success": True, "backup_id": backup.id, "hostname": switch.hostname, "config_hash": config_hash}

    except NetmikoTimeoutException as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        _log_audit("config_backup", "switch", switch_id, "failure", {"error": str(e)})
        return {"error": f"SSH timeout: {e}"}
    except NetmikoAuthenticationException as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        _log_audit("config_backup", "switch", switch_id, "failure", {"error": "Auth failed"})
        return {"error": f"Authentication failed: {e}"}
    except Exception as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        _log_audit("config_backup", "switch", switch_id, "failure", {"error": str(e)})
        return {"error": str(e)}
    finally:
        db.close()


def push_config(switch_id: int, config_commands: list[str]) -> dict:
    """Push configuration commands to a switch via SSH.

    This is a state-changing operation that should require human approval.
    """
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        device_params = _get_device_connection(switch)
        conn = ConnectHandler(**device_params)
        conn.enable()

        output_lines = []
        for cmd in config_commands:
            output = conn.send_command(cmd, delay_factor=2)
            output_lines.append(f"# {cmd}\n{output}")

        conn.disconnect()
        result = "\n".join(output_lines)

        _log_audit("config_push", "switch", switch_id, "success",
                   {"commands_count": len(config_commands)})
        return {"success": True, "output": result, "hostname": switch.hostname}

    except Exception as e:
        _log_audit("config_push", "switch", switch_id, "failure", {"error": str(e)})
        return {"error": str(e)}
    finally:
        db.close()


def check_health(switch_id: int) -> dict:
    """Quick health check on a switch — CPU, memory, uptime."""
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        device_params = _get_device_connection(switch)
        conn = ConnectHandler(**device_params)
        conn.enable()

        vendor_commands = SHOW_COMMANDS.get(switch.vendor, SHOW_COMMANDS["cisco_ios"])
        health_output = conn.send_command(vendor_commands.get("health", "show clock"))
        memory_output = conn.send_command(vendor_commands.get("memory", ""), delay_factor=2)
        version_output = conn.send_command(vendor_commands.get("version", "show version"), delay_factor=2)
        interface_output = conn.send_command(vendor_commands.get("interfaces", ""), delay_factor=2)
        conn.disconnect()

        # Parse basic metrics
        cpu = None
        cpu_match = re.search(r'(\d+\.?\d*)%', health_output)
        if cpu_match:
            cpu = float(cpu_match.group(1))

        mem = None
        mem_match = re.search(r'(\d+)/(\d+)', memory_output)
        if mem_match:
            used, total = int(mem_match.group(1)), int(mem_match.group(2))
            mem = round((used / total) * 100, 1) if total > 0 else None

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
            memory_usage=mem,
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
            "memory": mem,
            "interfaces_up": intf_up,
            "interfaces_down": intf_down,
        }
    except Exception as e:
        db.query(Switch).filter_by(id=switch_id).update({"status": "offline"})
        db.commit()
        return {"error": str(e)}
    finally:
        db.close()


def execute_commands(switch_id: int, commands: list[str]) -> dict:
    """Execute arbitrary show commands on a switch (read-only)."""
    db = SessionLocal()
    try:
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        device_params = _get_device_connection(switch)
        conn = ConnectHandler(**device_params)
        conn.enable()

        results = {}
        for cmd in commands:
            results[cmd] = conn.send_command(cmd, delay_factor=2)

        conn.disconnect()
        return {"success": True, "hostname": switch.hostname, "results": results}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


def bulk_backup_all() -> dict:
    """Back up all switches that are marked as online or unknown."""
    db = SessionLocal()
    try:
        switches = db.query(Switch).filter(Switch.status.in_(["online", "unknown"])).all()
        results = []
        for sw in switches:
            result = pull_running_config(sw.id)
            results.append({"hostname": sw.hostname, "result": result})
        return {"backed_up": len(results), "results": results}
    finally:
        db.close()

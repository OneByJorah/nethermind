#!/usr/bin/env python3
"""nethermind CLI — Manage network switches from the terminal.

Usage:
  nethermind switches list [--status=online]
  nethermind switches add <hostname> <ip> [--vendor=aruba_os]
  nethermind switches delete <id>
  nethermind switches health <id>
  nethermind switches sync <id>
  nethermind switches commands <id> <command>...
  nethermind configs list [--switch-id=N]
  nethermind configs latest <switch-id>
  nethermind configs diff <backup-a> <backup-b>
  nethermind security audit <switch-id>
  nethermind security findings [--switch-id=N]
  nethermind dashboard stats
  nethermind dashboard health
  nethermind server start [--backend-only] [--frontend-only]
  nethermind server stop
"""
import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

API_BASE = os.environ.get("NETHERMIND_API", "http://localhost:8000")
ROOT_DIR = Path(__file__).resolve().parent.parent


def _req(method, path, data=None):
    import urllib.request
    import urllib.error
    url = f"{API_BASE}/api{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try:
            return json.loads(err)
        except json.JSONDecodeError:
            return {"error": err}
    except urllib.error.URLError:
        return {"error": f"Cannot connect to {API_BASE}. Is the server running?"}


def _print_table(rows, headers=None):
    if not rows:
        print("No results.")
        return
    if headers:
        fmt = "  ".join(f"{{:<{len(h)+2}}}" for h in headers)
        sep = "  ".join("-" * (len(h) + 2) for h in headers)
        print(fmt.format(*headers))
        print(sep)
        for row in rows:
            vals = [str(row.get(h.lower().replace(" ", "_"), "")) for h in headers]
            print(fmt.format(*vals))
    else:
        for row in rows:
            print(json.dumps(row, indent=2))


# ── Switch Commands ──

def cmd_switch_list(args):
    data = _req("GET", f"/switches/?status={args.status or ''}")
    _print_table(data, ["id", "hostname", "ip_address", "vendor", "status", "location"])


def cmd_switch_add(args):
    payload = {"hostname": args.hostname, "ip_address": args.ip, "vendor": args.vendor}
    if args.ssh_port: payload["ssh_port"] = args.ssh_port
    if args.username: payload["ssh_username"] = args.username
    if args.password: payload["ssh_password"] = args.password
    result = _req("POST", "/switches/", payload)
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print(f"Added switch: {result['hostname']} (ID: {result['id']}, IP: {result['ip_address']})")


def cmd_switch_delete(args):
    result = _req("DELETE", f"/switches/{args.id}")
    print(result.get("message", f"Switch {args.id} deleted"))


def cmd_switch_health(args):
    result = _req("POST", f"/switches/{args.id}/health")
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        print(f"Health for {result.get('hostname', args.id)}:")
        print(f"  CPU: {result.get('cpu', 'N/A')}%")
        print(f"  Memory: {result.get('memory', 'N/A')}%")
        print(f"  Interfaces: {result.get('interfaces_up', 0)} up / {result.get('interfaces_down', 0)} down")


def cmd_switch_sync(args):
    result = _req("POST", f"/switches/{args.id}/sync")
    print(result.get("message", f"Sync started for switch {args.id}"))


def cmd_switch_commands(args):
    result = _req("POST", f"/switches/{args.id}/commands", args.commands)
    if "error" in result:
        print(f"Error: {result['error']}")
    else:
        for cmd, output in result.get("results", {}).items():
            print(f"# {cmd}")
            print(output)


# ── Config Commands ──

def cmd_config_list(args):
    path = "/configs/"
    if args.switch_id:
        path = f"/configs/?switch_id={args.switch_id}"
    data = _req("GET", path)
    _print_table(data, ["id", "switch_id", "config_type", "config_hash", "created_at"])


def cmd_config_latest(args):
    data = _req("GET", f"/configs/{args.switch_id}/latest")
    if data.get("config"):
        print(f"Latest config for {data.get('hostname', args.switch_id)} (backup #{data.get('backup_id')}):")
        print(data["config"])
    else:
        print("No config found for this switch.")


def cmd_config_diff(args):
    data = _req("POST", f"/configs/diff?backup_id_a={args.backup_a}&backup_id_b={args.backup_b}")
    if "diff" in data:
        print(data["diff"])
        print(f"\n---\nAdditions: {data.get('additions', 0)}, Deletions: {data.get('deletions', 0)}")
    else:
        print(data)


# ── Security Commands ──

def cmd_security_audit(args):
    print(f"Running security audit on switch {args.switch_id}...")
    data = _req("POST", f"/security/audit/{args.switch_id}")
    if "error" in data:
        print(f"Error: {data['error']}")
    else:
        print(f"Audit complete: {data.get('findings_created', 0)} findings")
        print(f"  Critical: {data.get('critical', 0)}")
        print(f"  High: {data.get('high', 0)}")
        print(f"  Medium: {data.get('medium', 0)}")
        print(f"  Low: {data.get('low', 0)}")


def cmd_security_findings(args):
    path = "/security/findings"
    if args.switch_id:
        path += f"?switch_id={args.switch_id}"
    data = _req("GET", path)
    _print_table(data, ["id", "switch_id", "severity", "title", "status", "created_at"])


# ── Dashboard Commands ──

def cmd_dashboard_stats(_args):
    data = _req("GET", "/dashboard/stats")
    print("Nethermind Dashboard Stats:")
    print(f"  Total Switches:    {data.get('total_switches', 0)}")
    print(f"  Online:            {data.get('online_switches', 0)}")
    print(f"  Offline:           {data.get('offline_switches', 0)}")
    print(f"  Config Backups:    {data.get('total_configs', 0)}")
    print(f"  Open Findings:     {data.get('open_security_findings', 0)}")
    print(f"  Active Workflows:  {data.get('active_workflows', 0)}")


def cmd_dashboard_health(_args):
    data = _req("GET", "/dashboard/health-summary")
    _print_table(data, ["hostname", "ip_address", "status", "vendor", "cpu_usage",
                         "memory_usage", "interfaces_up", "open_findings"])


# ── Server Commands ──

SERVER_PIDS = {}

def cmd_server_start(args):
    backend_only = args.backend_only
    frontend_only = args.frontend_only

    if not frontend_only:
        print("Starting backend...")
        backend_env = os.environ.copy()
        backend_env["PYTHONPATH"] = str(ROOT_DIR / "backend")
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=ROOT_DIR / "backend",
            env=backend_env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        SERVER_PIDS["backend"] = proc.pid
        print(f"  Backend PID: {proc.pid}")
        time.sleep(2)

    if not backend_only:
        print("Starting frontend...")
        proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=ROOT_DIR / "frontend",
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        SERVER_PIDS["frontend"] = proc.pid
        print(f"  Frontend PID: {proc.pid}")

    if not backend_only and not frontend_only:
        print(f"\nDashboard: http://localhost:3000")
        print(f"API:       http://localhost:8000")
        print(f"Docs:      http://localhost:8000/docs")


def cmd_server_stop(_args):
    pid_file = Path("/tmp/nethermind-backend.pid")
    if pid_file.exists():
        try:
            pid = int(pid_file.read_text().strip())
            os.kill(pid, signal.SIGTERM)
            print(f"Stopped backend (PID {pid})")
            pid_file.unlink()
        except (ProcessLookupError, ValueError, OSError):
            pid_file.unlink(missing_ok=True)
    subprocess.run(["pkill", "-f", "next dev"], capture_output=True)
    print("Stopped frontend")


# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="nethermind — Network Switch Manager CLI")
    parser.add_argument("--api", help=f"API base URL (default: {API_BASE})")

    sub = parser.add_subparsers(dest="command")

    # switches
    sw = sub.add_parser("switches")
    sw_sub = sw.add_subparsers(dest="action")

    sw_list = sw_sub.add_parser("list")
    sw_list.add_argument("--status")

    sw_add = sw_sub.add_parser("add")
    sw_add.add_argument("hostname")
    sw_add.add_argument("ip")
    sw_add.add_argument("--vendor", default="aruba_os")
    sw_add.add_argument("--ssh-port", type=int, default=22)
    sw_add.add_argument("--username")
    sw_add.add_argument("--password")

    sw_del = sw_sub.add_parser("delete")
    sw_del.add_argument("id", type=int)

    sw_health = sw_sub.add_parser("health")
    sw_health.add_argument("id", type=int)

    sw_sync = sw_sub.add_parser("sync")
    sw_sync.add_argument("id", type=int)

    sw_cmd = sw_sub.add_parser("commands")
    sw_cmd.add_argument("id", type=int)
    sw_cmd.add_argument("commands", nargs="+")

    # configs
    cfg = sub.add_parser("configs")
    cfg_sub = cfg.add_subparsers(dest="action")

    cfg_list = cfg_sub.add_parser("list")
    cfg_list.add_argument("--switch-id", type=int)

    cfg_latest = cfg_sub.add_parser("latest")
    cfg_latest.add_argument("switch_id", type=int)

    cfg_diff = cfg_sub.add_parser("diff")
    cfg_diff.add_argument("backup_a", type=int)
    cfg_diff.add_argument("backup_b", type=int)

    # security
    sec = sub.add_parser("security")
    sec_sub = sec.add_subparsers(dest="action")

    sec_audit = sec_sub.add_parser("audit")
    sec_audit.add_argument("switch_id", type=int)

    sec_findings = sec_sub.add_parser("findings")
    sec_findings.add_argument("--switch-id", type=int)

    # dashboard
    dash = sub.add_parser("dashboard")
    dash_sub = dash.add_subparsers(dest="action")
    dash_sub.add_parser("stats")
    dash_sub.add_parser("health")

    # server
    srv = sub.add_parser("server")
    srv_sub = srv.add_subparsers(dest="action")

    srv_start = srv_sub.add_parser("start")
    srv_start.add_argument("--backend-only", action="store_true")
    srv_start.add_argument("--frontend-only", action="store_true")

    srv_sub.add_parser("stop")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    global API_BASE
    if args.api:
        API_BASE = args.api

    handlers = {
        ("switches", "list"): cmd_switch_list,
        ("switches", "add"): cmd_switch_add,
        ("switches", "delete"): cmd_switch_delete,
        ("switches", "health"): cmd_switch_health,
        ("switches", "sync"): cmd_switch_sync,
        ("switches", "commands"): cmd_switch_commands,
        ("configs", "list"): cmd_config_list,
        ("configs", "latest"): cmd_config_latest,
        ("configs", "diff"): cmd_config_diff,
        ("security", "audit"): cmd_security_audit,
        ("security", "findings"): cmd_security_findings,
        ("dashboard", "stats"): cmd_dashboard_stats,
        ("dashboard", "health"): cmd_dashboard_health,
        ("server", "start"): cmd_server_start,
        ("server", "stop"): cmd_server_stop,
    }

    handler = handlers.get((args.command, getattr(args, "action", None)))
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

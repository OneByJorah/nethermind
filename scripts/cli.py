"""Command-line interface for Nethermind — network switch configuration manager."""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from services.switch_config_model import SwitchConfig
from services.connection import ConnParams, Connection
from services.deployer import Deployer
from services.config_parser import parse_file, parse_config
from services.switch_config_model import standard_access_switch, standard_core_switch


def cmd_render(args):
    if args.from_json:
        cfg = SwitchConfig.from_json(Path(args.from_json).read_text())
    elif args.from_existing:
        cfg = parse_file(args.from_existing)
    elif args.role == "core":
        cfg = standard_core_switch(args.hostname, args.backbone_ip, args.backbone_mask,
                                   args.backbone_port)
    else:
        cfg = standard_access_switch(args.hostname, args.mgmt_ip, args.mgmt_mask,
                                     args.gateway)
    if args.out:
        Path(args.out).write_text(render_config(cfg))
        print(f"wrote {args.out}")
    else:
        print(render_config(cfg))


def cmd_parse(args):
    cfg = parse_file(args.file)
    if args.json:
        Path(args.json).write_text(cfg.to_json())
        print(f"wrote {args.json}")
    else:
        print(cfg.to_json())


def cmd_deploy(args):
    logging.basicConfig(level=logging.INFO)
    if args.from_json:
        cfg = SwitchConfig.from_json(Path(args.from_json).read_text())
    elif args.from_existing:
        cfg = parse_file(args.from_existing)
    else:
        cfg = standard_access_switch(args.hostname, args.mgmt_ip, args.mgmt_mask,
                                     args.gateway)
    errs = cfg.validate()
    if errs:
        print("CONFIG INVALID:")
        for e in errs:
            print(" -", e)
        sys.exit(2)

    params = ConnParams(
        transport=args.transport,
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        serial_port=args.serial,
        baud=args.baud,
    )
    conn = Connection.build(params)
    res = Deployer(conn, progress=print).deploy(cfg)
    print("\n=== RESULT ===")
    print(f"success={res.success} lines_sent={res.lines_sent} "
          f"hostname_seen={res.hostname_seen!r}")
    if res.errors:
        print("ERRORS:")
        for e in res.errors:
            print(" -", e)
    sys.exit(0 if res.success else 1)




def cmd_upload(args):
    """Upload a .txt config file: parse it and save as JSON."""
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"ERROR: file not found: {args.file}")
        sys.exit(1)

    print(f"Parsing {file_path.name}...")
    cfg = parse_file(str(file_path))

    # Determine output path
    if args.out:
        out_path = Path(args.out)
    else:
        out_path = file_path.with_suffix('.json')

    out_path.write_text(cfg.to_json())
    print(f"Saved structured config to {out_path}")
    print(f"  hostname: {cfg.hostname}")
    print(f"  role:     {cfg.role}")
    print(f"  vlans:    {len(cfg.vlans)}")
    if cfg.vlans:
        for v in cfg.vlans:
            print(f"    vlan {v.id}: {v.name or '(unnamed)'}")


def cmd_backup(args):
    """Connect to a live switch and pull its running config."""
    logging.basicConfig(level=logging.INFO)

    params = ConnParams(
        transport=args.transport,
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        serial_port=args.serial,
        baud=args.baud,
    )

    print(f"Connecting to {args.host} via {args.transport}...")
    conn = Connection.build(params)
    conn.connect()

    # Get to privileged exec
    from services.connection import PRIV_PROMPT, OPER_PROMPT
    conn.read_until(PRIV_PROMPT + "|" + OPER_PROMPT, timeout=8.0)

    # Pull running config
    print("Pulling running config...")
    conn.send_line("show running-config", delay=2.0)
    config_text = conn.read_until(PRIV_PROMPT, timeout=30.0)

    # Clean up: remove echo of the command itself and the prompt
    lines = config_text.splitlines()
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip the command echo and prompt lines
        if stripped.startswith("show running-config"):
            continue
        if stripped.endswith(">") or stripped.endswith("#") and len(stripped) < 30:
            continue
        clean_lines.append(line)

    config_text = "
".join(clean_lines).strip() + "
"

    conn.close()

    # Determine output path
    if args.out:
        out_path = Path(args.out)
    else:
        hostname = "switch"
        for line in config_text.splitlines():
            if line.strip().startswith("hostname"):
                parts = line.split()
                if len(parts) >= 2:
                    hostname = parts[1].strip().strip('"')
                break
        out_path = Path(f"{hostname}_backup.txt")

    out_path.write_text(config_text)
    print(f"Config saved to {out_path}")
    print(f"  {len(config_text.splitlines())} lines backed up")

    # Also save as parsed JSON if requested
    if args.json:
        try:
            cfg = parse_config(config_text)
            json_path = Path(args.json)
            json_path.write_text(cfg.to_json())
            print(f"Structured JSON saved to {json_path}")
            print(f"  hostname: {cfg.hostname}")
            print(f"  role:     {cfg.role}")
            print(f"  vlans:    {len(cfg.vlans)}")
        except Exception as e:
            print(f"Warning: could not parse config to JSON: {e}")


def render_config(cfg):
    """Render a SwitchConfig using the Jinja2 template engine."""
    from jinja2 import Environment, FileSystemLoader
    import os
    template_dir = Path(__file__).resolve().parent.parent / "templates"
    env = Environment(loader=FileSystemLoader(str(template_dir)), keep_trailing_newline=True)
    tpl = env.get_template("arubaos_full_config.j2")
    vlans = [v.to_dict() for v in cfg.vlans]
    if cfg.management_vlan_ip and cfg.role == "access":
        for v in vlans:
            if v["id"] == 1 and not v.get("ip"):
                v["ip"] = cfg.management_vlan_ip
                v["mask"] = cfg.management_vlan_mask
    ctx = cfg.to_dict()
    ctx["vlans"] = vlans
    text = tpl.render(**ctx)
    lines = [ln.rstrip() for ln in text.splitlines()]
    out = []
    for ln in lines:
        if ln == "" and out and out[-1] == "":
            continue
        out.append(ln)
    return "\n".join(out).strip() + "\n"


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="nethermind-cli",
        description="Nethermind — configure Aruba/ProCurve switches via "
                    "console, SSH or Telnet.")
    sub = p.add_subparsers(dest="cmd", required=True)


    # upload
    up = sub.add_parser("upload", help="upload a .txt config: parse and save as JSON")
    up.add_argument("file", help="path to the .txt running-config file")
    up.add_argument("--out", help="output JSON path (default: same name .json)")
    up.set_defaults(func=cmd_upload)

    # backup
    bu = sub.add_parser("backup", help="pull running config from a live switch")
    bu.add_argument("--transport", choices=["serial", "ssh", "telnet"], default="telnet")
    bu.add_argument("--host", default="127.0.0.1")
    bu.add_argument("--port", type=int, default=9023)
    bu.add_argument("--username", default="admin")
    bu.add_argument("--password", default="")
    bu.add_argument("--serial", default="COM3")
    bu.add_argument("--baud", type=int, default=9600)
    bu.add_argument("--out", help="save raw config to this path")
    bu.add_argument("--json", help="also save parsed JSON to this path")
    bu.set_defaults(func=cmd_backup)

    # render
    r = sub.add_parser("render", help="render a config to CLI text")
    r.add_argument("--hostname", default="TEST-SW")
    r.add_argument("--role", choices=["access", "core"], default="access")
    r.add_argument("--mgmt-ip", default="192.168.1.99")
    r.add_argument("--mgmt-mask", default="255.255.255.0")
    r.add_argument("--gateway", default="192.168.1.1")
    r.add_argument("--backbone-ip", default="10.0.0.25")
    r.add_argument("--backbone-mask", default="255.255.255.0")
    r.add_argument("--backbone-port", default="A2")
    r.add_argument("--from-json", help="build from a saved JSON config")
    r.add_argument("--from-existing", help="re-template an existing .txt config")
    r.add_argument("--out", help="write to file instead of stdout")
    r.set_defaults(func=cmd_render)

    # parse
    pa = sub.add_parser("parse", help="parse an existing .txt config into JSON")
    pa.add_argument("file")
    pa.add_argument("--json", help="write JSON to this path")
    pa.set_defaults(func=cmd_parse)

    # deploy
    d = sub.add_parser("deploy", help="connect and push a config to a switch")
    d.add_argument("--transport", choices=["serial", "ssh", "telnet"],
                   default="telnet")
    d.add_argument("--host", default="127.0.0.1")
    d.add_argument("--port", type=int, default=9023)
    d.add_argument("--username", default="admin")
    d.add_argument("--password", default="")
    d.add_argument("--serial", default="COM3")
    d.add_argument("--baud", type=int, default=9600)
    d.add_argument("--hostname", default="TEST-SW")
    d.add_argument("--role", choices=["access", "core"], default="access")
    d.add_argument("--mgmt-ip", default="192.168.1.99")
    d.add_argument("--mgmt-mask", default="255.255.255.0")
    d.add_argument("--gateway", default="192.168.1.1")
    d.add_argument("--from-json", help="load a saved JSON config")
    d.add_argument("--from-existing", help="load an existing .txt config")
    d.set_defaults(func=cmd_deploy)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

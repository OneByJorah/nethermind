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
from services.config_parser import parse_file
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

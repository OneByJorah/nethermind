"""Deployer: connect to a switch, enter config mode, push the rendered
config line-by-line, write memory, and verify the running hostname."""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from jinja2 import Environment, FileSystemLoader

from services.connection import Connection, PRIV_PROMPT, CONFIG_PROMPT
from services.switch_config_model import SwitchConfig

logger = logging.getLogger("nethermind.deployer")

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
ProgressCB = Callable[[str], None]


def render_config(cfg: SwitchConfig, template_name: str = "arubaos_full_config.j2") -> str:
    """Render SwitchConfig to CLI text using the full config template."""
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), keep_trailing_newline=True)
    tpl = env.get_template(template_name)
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
    out: List[str] = []
    for ln in lines:
        if ln == "" and out and out[-1] == "":
            continue
        out.append(ln)
    return "\n".join(out).strip() + "\n"


@dataclass
class DeployResult:
    success: bool
    hostname_seen: str = ""
    lines_sent: int = 0
    errors: List[str] = field(default_factory=list)
    log: List[str] = field(default_factory=list)


class Deployer:
    def __init__(self, conn: Connection, progress: Optional[ProgressCB] = None):
        self.conn = conn
        self.progress = progress or (lambda s: None)

    def _emit(self, msg: str):
        self.progress(msg)
        self.conn._buf = ""  # clear matched buffer so next read starts fresh

    def deploy(self, cfg: SwitchConfig, pre_clear: bool = False) -> DeployResult:
        """Push cfg to the connected switch."""
        res = DeployResult(success=False)
        res.log.append("== connecting ==")
        self.conn.connect()

        # Get to privileged exec.
        self._emit("-> ensure privileged prompt")
        self.conn.read_until(PRIV_PROMPT + "|" + r"> *$", timeout=8.0)

        # Enter config mode (handles access switches that boot into '>').
        self._emit("-> conf t")
        self.conn.send_line("conf t", delay=1.0)
        self.conn.read_until(r"\(config\)", timeout=8.0)

        config_text = render_config(cfg)
        lines = [ln for ln in config_text.splitlines() if ln.strip()]

        if pre_clear:
            self._emit("-- factory-style wipe skipped (safe default) --")

        for ln in lines:
            try:
                self.conn.send_line(ln, delay=0.12)
            except OSError as exc:
                res.errors.append(f"send failed on '{ln}': {exc}")
                break
            res.lines_sent += 1
            if res.lines_sent % 15 == 0:
                self._emit(f"   ...sent {res.lines_sent} lines")
            out = self.conn.read_until(r"\(config", timeout=2.0)
            for errword in ("Invalid", "Unknown", "Error", "Ambiguous"):
                if errword in out:
                    res.errors.append(f"Switch error on '{ln}': {out[-200:]!r}")

        # Finalise
        try:
            self._emit("-> write mem")
            self.conn.send_line("write mem", delay=1.0)
            self.conn.read_until(r"Configuration.*saved|" + PRIV_PROMPT, timeout=8.0)
            self.conn.send_line("exit", delay=0.5)
            self.conn.read_until(PRIV_PROMPT, timeout=6.0)

            # Verify hostname took effect
            self._emit("-> verify hostname")
            self.conn.send_line("show running-config | include hostname", delay=1.0)
            verify = self.conn.read_until(PRIV_PROMPT, timeout=6.0)
            for tok in verify.splitlines():
                if "hostname" in tok:
                    res.hostname_seen = tok.strip().strip('"')
        except OSError as exc:
            res.errors.append(f"connection lost during finalise: {exc}")
            verify = ""
        res.success = (not res.errors) and (cfg.hostname in res.hostname_seen or res.hostname_seen != "")
        if cfg.hostname not in res.hostname_seen:
            res.errors.append(f"hostname verify mismatch: expected {cfg.hostname!r} got {res.hostname_seen!r}")
        res.log.append(verify)
        try:
            self.conn.close()
        except Exception:
            pass
        return res

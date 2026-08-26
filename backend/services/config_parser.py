"""Parse an existing ArubaOS-Switch / ProCurve running-config (.txt export)
into structured SwitchConfig data.
"""
from __future__ import annotations

import re
from typing import List, Optional

from services.switch_config_model import SwitchConfig, Vlan, RadiusServer

_HOST_RE = re.compile(r'hostname\s+"?([^"\r\n]+)"?')
_VLAN_RE = re.compile(r"^vlan\s+(\d+)")
_IP_RE = re.compile(r"ip address\s+([\d.]+)\s+([\d.]+)")
_HELPER_RE = re.compile(r"ip helper-address\s+([\d.]+)")
_NAME_RE = re.compile(r'name\s+"?([^"\r\n]+)"?')
_UNTAGGED_RE = re.compile(r"untagged\s+(.+)")
_TAGGED_RE = re.compile(r"tagged\s+(.+)")
_RAD_RE = re.compile(r'radius-server host\s+([\d.]+)\s+key\s+"?([^"\r\n]+)"?')
_SNTP_RE = re.compile(r"sntp server(?:\s+priority\s+\d+)?\s+([\d.]+)")
_DHCP_SRV_RE = re.compile(r"dhcp-snooping authorized-server\s+([\d.]+)")
_TRUST_RE = re.compile(r"dhcp-snooping trust\s+(.+)")
_GW_RE = re.compile(r"ip default-gateway\s+([\d.]+)")
_TZ_RE = re.compile(r"time timezone\s+(-?\d+)")
_ACCESS_PORTS_RE = re.compile(r"port-security\s+([\dA-H,\-\s]+?)\s+learn-mode")
_SFLOW_PORTS_RE = re.compile(r"sflow 1 (?:polling|sampling)\s+([\dA-H,\-\s]+?)\s+\d")


def parse_config(text: str) -> SwitchConfig:
    lines = text.splitlines()
    cfg = SwitchConfig()

    m = _HOST_RE.search(text)
    if m:
        cfg.hostname = m.group(1).strip()

    m = _GW_RE.search(text)
    if m:
        cfg.default_gateway = m.group(1)

    m = _TZ_RE.search(text)
    if m:
        cfg.timezone = int(m.group(1))

    cfg.role = "core" if ("ip routing" in text or "router ospf" in text) else "access"

    if "snmpv3 enable" in text:
        cfg.snmpv3 = True

    cfg.radius_servers = [
        RadiusServer(host=h, key=k) for h, k in _RAD_RE.findall(text)
    ]

    cfg.sntp_servers = _SNTP_RE.findall(text)

    cfg.dhcp_authorized_servers = _DHCP_SRV_RE.findall(text)
    cfg.dhcp_option82 = "dhcp-snooping option 82" in text

    tr = _TRUST_RE.findall(text)
    if tr:
        cfg.trust_ports = tr[0].strip()

    ap = _ACCESS_PORTS_RE.search(text)
    if ap:
        cfg.access_ports = ap.group(1).strip()

    sf = _SFLOW_PORTS_RE.search(text)
    if sf:
        cfg.sflow_ports = sf.group(1).split()[0].strip()

    # VLANs - block parsing
    vlans: List[Vlan] = []
    current: Optional[Vlan] = None
    in_vlan = False
    for raw in lines:
        line = raw.rstrip()
        mv = _VLAN_RE.match(line)
        if mv:
            if current:
                vlans.append(current)
            current = Vlan(id=int(mv.group(1)))
            in_vlan = True
            continue
        if in_vlan:
            if line.strip() == "exit":
                in_vlan = False
                continue
            nm = _NAME_RE.search(line)
            if nm and current is not None and not current.name:
                current.name = nm.group(1).strip()
                continue
            um = _UNTAGGED_RE.search(line)
            if um and current is not None:
                current.untagged = um.group(1).strip()
                continue
            tm = _TAGGED_RE.search(line)
            if tm and current is not None:
                current.tagged = tm.group(1).strip()
                continue
            im = _IP_RE.search(line)
            if im and current is not None:
                current.ip = im.group(1)
                current.mask = im.group(2)
                continue
            hm = _HELPER_RE.search(line)
            if hm and current is not None:
                current.helper = hm.group(1)
                continue
    if current:
        vlans.append(current)
    cfg.vlans = vlans

    # Pull management IP off vlan 1
    for v in vlans:
        if v.id == 1 and v.ip:
            cfg.management_vlan_ip = v.ip
            cfg.management_vlan_mask = v.mask
            break

    return cfg


def parse_file(path: str) -> SwitchConfig:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return parse_config(fh.read())

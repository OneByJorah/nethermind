"""Data model for an ArubaOS-Switch / ProCurve switch configuration.

This is the single source of truth the GUI, CLI, template engine and
parser all share.  Everything serialises to/from plain dicts so configs can
be saved as JSON and reloaded.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional


@dataclass
class Vlan:
    id: int
    name: str = ""
    untagged: str = ""          # e.g. "1-28" or "A2"
    tagged: str = ""            # e.g. "25-28"
    ip: str = ""                # interface IP (core/L3 switches)
    mask: str = ""              # subnet mask
    helper: str = ""            # ip helper-address (dhcp relay)

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict) -> "Vlan":
        return cls(
            id=int(d["id"]),
            name=d.get("name", ""),
            untagged=d.get("untagged", ""),
            tagged=d.get("tagged", ""),
            ip=d.get("ip", ""),
            mask=d.get("mask", ""),
            helper=d.get("helper", ""),
        )


@dataclass
class RadiusServer:
    host: str
    key: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict) -> "RadiusServer":
        return cls(host=d["host"], key=d.get("key", ""))


@dataclass
class SwitchConfig:
    hostname: str = ""
    role: str = "access"            # "access" | "core"
    timezone: int = -240
    default_gateway: str = ""       # access switches
    management_vlan_ip: str = ""    # quick-fill for vlan 1
    management_vlan_mask: str = ""
    snmpv3: bool = False
    snmp_contact: str = "OIT"
    radius_servers: List[RadiusServer] = field(default_factory=list)
    vlans: List[Vlan] = field(default_factory=list)
    access_ports: str = "1-24"      # port-security / stp / loop-protect scope
    trust_ports: str = "25-28"      # uplinks trusted for dhcp-snooping
    dhcp_authorized_servers: List[str] = field(default_factory=list)
    dhcp_option82: bool = False
    sntp_servers: List[str] = field(default_factory=lambda: ["192.168.1.2", "192.168.1.4"])
    # core only
    ospf_area: str = "0.0.0.1"
    sflow_dest: str = "10.0.0.100"
    sflow_port: int = 2055
    sflow_ports: str = ""
    backbone_vlan: int = 11
    backbone_port: str = "A2"

    # ---------- serialisation ----------
    def to_dict(self) -> Dict:
        d = asdict(self)
        d["radius_servers"] = [r.to_dict() for r in self.radius_servers]
        d["vlans"] = [v.to_dict() for v in self.vlans]
        return d

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_dict(cls, d: Dict) -> "SwitchConfig":
        cfg = cls(
            hostname=d.get("hostname", ""),
            role=d.get("role", "access"),
            timezone=int(d.get("timezone", -240)),
            default_gateway=d.get("default_gateway", ""),
            management_vlan_ip=d.get("management_vlan_ip", ""),
            management_vlan_mask=d.get("management_vlan_mask", ""),
            snmpv3=bool(d.get("snmpv3", False)),
            snmp_contact=d.get("snmp_contact", "OIT"),
            radius_servers=[RadiusServer.from_dict(x) for x in d.get("radius_servers", [])],
            vlans=[Vlan.from_dict(x) for x in d.get("vlans", [])],
            access_ports=d.get("access_ports", "1-24"),
            trust_ports=d.get("trust_ports", "25-28"),
            dhcp_authorized_servers=list(d.get("dhcp_authorized_servers", [])),
            dhcp_option82=bool(d.get("dhcp_option82", False)),
            sntp_servers=list(d.get("sntp_servers", ["192.168.1.2", "192.168.1.4"])),
            ospf_area=d.get("ospf_area", "0.0.0.1"),
            sflow_dest=d.get("sflow_dest", "10.0.0.100"),
            sflow_port=int(d.get("sflow_port", 2055)),
            sflow_ports=d.get("sflow_ports", ""),
            backbone_vlan=int(d.get("backbone_vlan", 11)),
            backbone_port=d.get("backbone_port", "A2"),
        )
        return cfg

    @classmethod
    def from_json(cls, text: str) -> "SwitchConfig":
        return cls.from_dict(json.loads(text))

    # ---------- validation ----------
    def validate(self) -> List[str]:
        errs: List[str] = []
        if not self.hostname:
            errs.append("hostname is required")
        if self.role not in ("access", "core"):
            errs.append("role must be 'access' or 'core'")
        if self.role == "access" and not self.default_gateway:
            errs.append("access switches need a default-gateway")
        if not self.vlans:
            errs.append("at least one VLAN is required")
        for v in self.vlans:
            if v.ip and not v.mask:
                errs.append(f"vlan {v.id} has IP but no mask")
            if self.role == "core" and v.ip and not self.sflow_ports:
                pass
        if self.role == "core" and not self.sflow_ports:
            errs.append("core switches need sflow_ports for sFlow polling")
        return errs


def standard_access_switch(hostname: str, mgmt_ip: str, mgmt_mask: str,
                           gateway: str) -> SwitchConfig:
    """Build the Standard 24/48-port access switch (2930F style)."""
    return SwitchConfig(
        hostname=hostname,
        role="access",
        timezone=-240,
        default_gateway=gateway,
        management_vlan_ip=mgmt_ip,
        management_vlan_mask=mgmt_mask,
        snmpv3=False,
        snmp_contact="OIT",
        radius_servers=[],
        access_ports="1-24",
        trust_ports="25-28",
        dhcp_authorized_servers=["192.168.1.10", "192.168.1.11"],
        dhcp_option82=True,
        sntp_servers=["192.168.1.2", "192.168.1.3"],
        vlans=[
            Vlan(id=1, name="DEFAULT_VLAN", untagged="1-28",
                 ip=mgmt_ip, mask=mgmt_mask),
            Vlan(id=2, name="VOIP", tagged="1-28"),
            Vlan(id=20, name="WAP", tagged="25-28"),
            Vlan(id=21, name="ARUBA_WAP", tagged="25-28"),
            Vlan(id=22, name="GUEST_WiFi"),
        ],
    )


def standard_core_switch(hostname: str, backbone_ip: str, backbone_mask: str,
                         backbone_port: str = "A2") -> SwitchConfig:
    """Build the Standard chassis core/router (5406 / 5500R style)."""
    return SwitchConfig(
        hostname=hostname,
        role="core",
        timezone=-240,
        snmpv3=True,
        snmp_contact="OIT",
        radius_servers=[
            RadiusServer(host="192.168.1.10", key=""),
            RadiusServer(host="192.168.1.11", key=""),
        ],
        access_ports="A5-A9,A11-A20,B1-B24,C1-C24,D1-D24,E1-E24,F1-F24,G1-G24,H1-H24",
        trust_ports="A21-A24",
        dhcp_authorized_servers=["192.168.1.10"],
        dhcp_option82=False,
        sntp_servers=["192.168.1.2", "192.168.1.3"],
        ospf_area="0.0.0.1",
        sflow_dest="10.0.0.100",
        sflow_port=2055,
        sflow_ports="A2,A21-A24",
        backbone_vlan=11,
        backbone_port=backbone_port,
        vlans=[
            Vlan(id=1, name="DEFAULT_VLAN", untagged=(
                "A1,A3,A5-A8,A11-A24,B1-B24,C1-C24,D1-D24,E1-E24,"
                "F1-F24,G1-G24,H1-H24"), ip="10.0.1.1", mask="255.255.255.0"),
            Vlan(id=2, name="VOIP", untagged="A4",
                 tagged="A21-A24,B1-B24,C1-C24,D1-D24,E1-E24,F1-F24,G1-G24,H1-H24",
                 ip="10.0.2.1", mask="255.255.255.0", helper="10.0.2.10"),
            Vlan(id=11, name="BACKBONE", untagged=backbone_port,
                 ip=backbone_ip, mask=backbone_mask),
            Vlan(id=20, name="WAP", tagged="A9-A10,A21-A24,C16,E16,F8",
                 ip="10.0.3.1", mask="255.255.255.0", helper="10.0.3.10"),
            Vlan(id=21, name="ARUBA_WAP", untagged="A9-A10,C16,E16,F8",
                 tagged="A21-A24", ip="10.0.4.1", mask="255.255.255.0",
                 helper="10.0.4.10"),
            Vlan(id=22, name="GUEST_WiFi", helper="10.0.1.10"),
        ],
    )

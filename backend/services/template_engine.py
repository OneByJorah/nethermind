"""Jinja2-based configuration template engine for network devices.

Provides template rendering with variable substitution, validation,
and a library of built-in templates for common network configurations.
"""
import json
import logging
from typing import Optional

from jinja2 import TemplateError, UndefinedError
from jinja2.sandbox import SandboxedEnvironment

from database import SessionLocal
from models import ConfigTemplate, AuditLog

logger = logging.getLogger(__name__)

# ─── Built-in Templates ───
# Comprehensive library covering HP ArubaOS-Switch (ProVision) and Cisco IOS

BUILTIN_TEMPLATES = [
    # ===== ARUBAOS-SWITCH TEMPLATES =====
    # --- Initial Setup & Management ---
    {
        "name": "Aruba - Initial Setup (Hostname, Mgmt IP, DNS)",
        "description": "Basic switch setup: hostname, management VLAN IP, default gateway, DNS servers",
        "vendor": "aruba_os",
        "category": "initial-setup",
        "template_body": """hostname "{{ hostname }}"
!
ip default-gateway {{ default_gateway }}
!
ip dns server-address {{ dns_primary }}
{% if dns_secondary %}
ip dns server-address {{ dns_secondary }}
{% endif %}
ip dns domain-name {{ domain_name }}
!
vlan {{ mgmt_vlan | default('1') }}
 name "MGMT-{{ hostname }}"
 ip address {{ mgmt_ip }} {{ mgmt_mask }}
 exit
!
ip routing
""",
        "variables": {
            "type": "object",
            "properties": {
                "hostname": {"type": "string", "description": "Switch hostname"},
                "mgmt_ip": {"type": "string", "description": "Management IP address"},
                "mgmt_mask": {"type": "string", "description": "Management subnet mask (e.g. 255.255.255.0)"},
                "default_gateway": {"type": "string", "description": "Default gateway IP"},
                "dns_primary": {"type": "string", "description": "Primary DNS server"},
                "dns_secondary": {"type": "string", "description": "Secondary DNS server (optional)"},
                "domain_name": {"type": "string", "description": "DNS domain name"},
                "mgmt_vlan": {"type": "string", "description": "Management VLAN ID (default: 1)"}
            },
            "required": ["hostname", "mgmt_ip", "mgmt_mask", "default_gateway", "dns_primary", "domain_name"]
        },
        "tags": "aruba,initial-setup,management,basic",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Factory Reset & Erase",
        "description": "Complete factory reset: erase startup config, delete VLAN database, and reload",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """# WARNING: This will erase ALL configuration and reload the switch!
# Step 1: Erase startup configuration
erase startup-config
#
# Step 2: Erase VLAN database
delete /force vlan.dat
#
# Step 3: Erase any stored config files
delete /force *.cfg
#
# Step 4: Clear SSH host keys
ip ssh host-key delete
#
# Step 5: Reset to factory defaults
erase factory-default
#
# Step 6: Reload the switch (confirmation required)
boot
""",
        "variables": {
            "type": "object",
            "properties": {}
        },
        "tags": "aruba,factory-reset,maintenance,erase",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Save Configuration",
        "description": "Save running config to startup config (write memory equivalent)",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """write memory
""",
        "variables": {"type": "object", "properties": {}},
        "tags": "aruba,save,maintenance",
        "is_builtin": True,
    },
    {
        "name": "Aruba - SSH & Management Access",
        "description": "Configure SSH server, local users, and management access",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """# Configure SSH
ip ssh
ip ssh version 2
ip ssh timeout {{ ssh_timeout | default('60') }}
ip ssh authentication-retries {{ ssh_retries | default('3') }}
!
# Generate SSH host key (RSA 2048)
crypto key generate ssh rsa modulus {{ rsa_bits | default('2048') }}
!
# Create admin user
user "{{ admin_username }}" password {{ admin_password }}
user "{{ admin_username }}" group managers
!
# Configure enable password
enable password {{ enable_password }}
!
# Management access - restrict to specific VLAN
ip management-vlan {{ mgmt_vlan | default('1') }}
!
# Disable telnet
no telnet-server
!
# Web management (HTTPS only)
web-management ssl
""",
        "variables": {
            "type": "object",
            "properties": {
                "admin_username": {"type": "string", "description": "Admin username"},
                "admin_password": {"type": "string", "description": "Admin password"},
                "enable_password": {"type": "string", "description": "Enable (privileged exec) password"},
                "ssh_timeout": {"type": "string", "description": "SSH timeout in seconds"},
                "ssh_retries": {"type": "string", "description": "SSH authentication retries"},
                "rsa_bits": {"type": "string", "description": "RSA key size (default: 2048)"},
                "mgmt_vlan": {"type": "string", "description": "Management VLAN ID"}
            },
            "required": ["admin_username", "admin_password", "enable_password"]
        },
        "tags": "aruba,ssh,security,management,access",
        "is_builtin": True,
    },
    {
        "name": "Aruba - SNMP v2c Configuration",
        "description": "Configure SNMP v2c with read/write communities, traps, and location",
        "vendor": "aruba_os",
        "category": "monitoring",
        "template_body": """# SNMP community strings
snmp-server community "{{ ro_community }}" ro
snmp-server community "{{ rw_community }}" rw
!
# SNMP location and contact
snmp-server location "{{ location }}"
snmp-server contact "{{ contact }}"
!
# SNMP traps
snmp-server enable traps
snmp-server host {{ trap_receiver }} community "{{ trap_community }}"
{% if trap_receiver2 %}
snmp-server host {{ trap_receiver2 }} community "{{ trap_community }}"
{% endif %}
!
# SNMPv3 user (optional)
{% if snmpv3_user %}
snmpv3 user "{{ snmpv3_user }}" auth md5 {{ snmpv3_auth }} priv aes {{ snmpv3_priv }}
{% endif %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "ro_community": {"type": "string", "description": "Read-only community string"},
                "rw_community": {"type": "string", "description": "Read-write community string"},
                "location": {"type": "string", "description": "Device physical location"},
                "contact": {"type": "string", "description": "Contact person/email"},
                "trap_receiver": {"type": "string", "description": "Primary SNMP trap receiver IP"},
                "trap_receiver2": {"type": "string", "description": "Secondary trap receiver (optional)"},
                "trap_community": {"type": "string", "description": "Trap community string"},
                "snmpv3_user": {"type": "string", "description": "SNMPv3 username (optional)"},
                "snmpv3_auth": {"type": "string", "description": "SNMPv3 auth password"},
                "snmpv3_priv": {"type": "string", "description": "SNMPv3 privacy password"}
            },
            "required": ["ro_community", "rw_community", "location", "contact", "trap_receiver", "trap_community"]
        },
        "tags": "aruba,snmp,monitoring,management",
        "is_builtin": True,
    },
    {
        "name": "Aruba - NTP & Time Configuration",
        "description": "Configure NTP servers, timezone, and daylight saving time",
        "vendor": "aruba_os",
        "category": "management",
        "template_body": """# Timezone configuration
time timezone {{ tz_offset }} {{ tz_name }}
{% if dst_enabled %}
time daylight-time-rule {{ dst_rule | default('usa') }}
{% endif %}
!
# NTP servers
ntp server {{ ntp_primary }}
{% if ntp_secondary %}
ntp server {{ ntp_secondary }}
{% endif %}
{% if ntp_tertiary %}
ntp server {{ ntp_tertiary }}
{% endif %}
!
# Enable NTP
ntp enable
""",
        "variables": {
            "type": "object",
            "properties": {
                "tz_offset": {"type": "string", "description": "Timezone offset in minutes (e.g. -300 for EST, -480 for PST)"},
                "tz_name": {"type": "string", "description": "Timezone name (e.g. EST, PST, UTC)"},
                "dst_enabled": {"type": "boolean", "description": "Enable daylight saving time"},
                "dst_rule": {"type": "string", "description": "DST rule: usa, europe, or custom"},
                "ntp_primary": {"type": "string", "description": "Primary NTP server IP/hostname"},
                "ntp_secondary": {"type": "string", "description": "Secondary NTP server (optional)"},
                "ntp_tertiary": {"type": "string", "description": "Tertiary NTP server (optional)"}
            },
            "required": ["tz_offset", "tz_name", "ntp_primary"]
        },
        "tags": "aruba,ntp,time,management",
        "is_builtin": True,
    },
    {
        "name": "Aruba - AAA & RADIUS Authentication",
        "description": "Configure RADIUS authentication for management access (SSH, console, web)",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """# RADIUS server configuration
radius-server host {{ radius_primary }} key "{{ radius_secret }}"
{% if radius_secondary %}
radius-server host {{ radius_secondary }} key "{{ radius_secret }}"
{% endif %}
radius-server timeout {{ radius_timeout | default('5') }}
radius-server retransmit {{ radius_retries | default('3') }}
!
# AAA authentication
aaa authentication login console local
aaa authentication login telnet radius local
aaa authentication login ssh radius local
aaa authentication login web radius local
!
# AAA authorization
aaa authorization commands radius local
aaa authorization console
!
# Enable RADIUS for enable password
aaa authentication enable radius local
""",
        "variables": {
            "type": "object",
            "properties": {
                "radius_primary": {"type": "string", "description": "Primary RADIUS server IP"},
                "radius_secondary": {"type": "string", "description": "Secondary RADIUS server IP (optional)"},
                "radius_secret": {"type": "string", "description": "RADIUS shared secret"},
                "radius_timeout": {"type": "string", "description": "RADIUS timeout in seconds"},
                "radius_retries": {"type": "string", "description": "RADIUS retransmit count"}
            },
            "required": ["radius_primary", "radius_secret"]
        },
        "tags": "aruba,aaa,radius,security,authentication",
        "is_builtin": True,
    },
    {
        "name": "Aruba - TACACS+ Authentication",
        "description": "Configure TACACS+ authentication for management access",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """# TACACS+ server configuration
tacacs-server host {{ tacacs_primary }} key "{{ tacacs_secret }}"
{% if tacacs_secondary %}
tacacs-server host {{ tacacs_secondary }} key "{{ tacacs_secret }}"
{% endif %}
tacacs-server timeout {{ tacacs_timeout | default('5') }}
!
# AAA authentication
aaa authentication login console local
aaa authentication login telnet tacacs local
aaa authentication login ssh tacacs local
aaa authentication login web tacacs local
!
# AAA authorization
aaa authorization commands tacacs local
aaa authorization console
!
# Enable TACACS+ for enable password
aaa authentication enable tacacs local
""",
        "variables": {
            "type": "object",
            "properties": {
                "tacacs_primary": {"type": "string", "description": "Primary TACACS+ server IP"},
                "tacacs_secondary": {"type": "string", "description": "Secondary TACACS+ server IP (optional)"},
                "tacacs_secret": {"type": "string", "description": "TACACS+ shared secret"},
                "tacacs_timeout": {"type": "string", "description": "TACACS+ timeout in seconds"}
            },
            "required": ["tacacs_primary", "tacacs_secret"]
        },
        "tags": "aruba,tacacs,security,authentication",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Banner Configuration",
        "description": "Set login banner, MOTD, and exec banner messages",
        "vendor": "aruba_os",
        "category": "management",
        "template_body": """# Login banner (shown before login)
banner login $
{{ banner_login }}
$
!
# MOTD banner (shown after login)
banner motd $
{{ banner_motd }}
$
""",
        "variables": {
            "type": "object",
            "properties": {
                "banner_login": {"type": "string", "description": "Login banner text (authorized access warning)"},
                "banner_motd": {"type": "string", "description": "Message of the day"}
            },
            "required": ["banner_login"]
        },
        "tags": "aruba,banner,management,security",
        "is_builtin": True,
    },
    # --- VLAN & Interface Configuration ---
    {
        "name": "Aruba - VLAN Creation (Multiple)",
        "description": "Create multiple VLANs with names and optional descriptions",
        "vendor": "aruba_os",
        "category": "vlan",
        "template_body": """{% for vlan in vlans %}
vlan {{ vlan.id }}
 name "{{ vlan.name }}"
{% if vlan.description %}
 description "{{ vlan.description }}"
{% endif %}
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "vlans": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "VLAN ID (1-4094)"},
                            "name": {"type": "string", "description": "VLAN name"},
                            "description": {"type": "string", "description": "Optional description"}
                        }
                    },
                    "description": "List of VLANs to create"
                }
            },
            "required": ["vlans"]
        },
        "tags": "aruba,vlan,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Access Port (Single VLAN)",
        "description": "Configure a port as access port in a specific VLAN",
        "vendor": "aruba_os",
        "category": "interface",
        "template_body": """interface {{ port }}
 name "{{ description | default('') }}"
 vlan access {{ vlan_id }}
{% if spanning_tree_edge %}
 spanning-tree edge-port
{% endif %}
{% if bpdu_guard %}
 spanning-tree bpdu-guard
{% endif %}
{% if broadcast_limit %}
 broadcast-limit {{ broadcast_limit }}
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port number (e.g. 1, A1, 1/1, 1/1/1)"},
                "vlan_id": {"type": "string", "description": "Access VLAN ID"},
                "description": {"type": "string", "description": "Port description"},
                "spanning_tree_edge": {"type": "boolean", "description": "Enable edge port (portfast)"},
                "bpdu_guard": {"type": "boolean", "description": "Enable BPDU guard"},
                "broadcast_limit": {"type": "string", "description": "Broadcast storm limit %"}
            },
            "required": ["port", "vlan_id"]
        },
        "tags": "aruba,interface,vlan,access,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Trunk Port (802.1Q)",
        "description": "Configure a port as 802.1Q trunk with allowed and native VLANs",
        "vendor": "aruba_os",
        "category": "interface",
        "template_body": """interface {{ port }}
 name "{{ description | default('') }}"
 vlan trunk allowed {{ allowed_vlans }}
 vlan trunk native {{ native_vlan | default('1') }}
{% if spanning_tree_edge %}
 spanning-tree edge-port
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port number"},
                "allowed_vlans": {"type": "string", "description": "Allowed VLANs (e.g. 10,20,30-40, all)"},
                "native_vlan": {"type": "string", "description": "Native VLAN ID (default: 1)"},
                "description": {"type": "string", "description": "Port description"},
                "spanning_tree_edge": {"type": "boolean", "description": "Enable edge port"}
            },
            "required": ["port", "allowed_vlans"]
        },
        "tags": "aruba,interface,trunk,vlan,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - LACP Trunk (Static LAG)",
        "description": "Configure a static LACP trunk group with member ports",
        "vendor": "aruba_os",
        "category": "interface",
        "template_body": """# Create trunk group
trunk {{ member_ports }} trk{{ trunk_id }} lacp
!
# Configure trunk interface
interface trk{{ trunk_id }}
 name "{{ description | default('') }}"
{% if trunk_mode == 'trunk' %}
 vlan trunk allowed {{ allowed_vlans | default('all') }}
 vlan trunk native {{ native_vlan | default('1') }}
{% elif trunk_mode == 'access' %}
 vlan access {{ access_vlan }}
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "trunk_id": {"type": "string", "description": "Trunk group ID (e.g. 1, 2, 3)"},
                "member_ports": {"type": "string", "description": "Member ports (e.g. 1-4, A1-A4)"},
                "trunk_mode": {"type": "string", "description": "trunk (tagged) or access (untagged)"},
                "allowed_vlans": {"type": "string", "description": "Allowed VLANs for trunk mode"},
                "native_vlan": {"type": "string", "description": "Native VLAN for trunk mode"},
                "access_vlan": {"type": "string", "description": "Access VLAN for access mode"},
                "description": {"type": "string", "description": "Trunk description"}
            },
            "required": ["trunk_id", "member_ports"]
        },
        "tags": "aruba,lacp,trunk,lag,interface,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - LACP Trunk (Dynamic)",
        "description": "Configure a dynamic LACP trunk (auto-negotiated)",
        "vendor": "aruba_os",
        "category": "interface",
        "template_body": """interface {{ port }}
 lacp {{ lacp_mode | default('active') }}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port to enable LACP on"},
                "lacp_mode": {"type": "string", "description": "LACP mode: active or passive"}
            },
            "required": ["port"]
        },
        "tags": "aruba,lacp,interface,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Interface Range Configuration",
        "description": "Apply configuration to a range of ports simultaneously",
        "vendor": "aruba_os",
        "category": "interface",
        "template_body": """# Configure port range
interface {{ port_range }}
{% if vlan_id %}
 vlan access {{ vlan_id }}
{% endif %}
{% if description %}
 name "{{ description }}"
{% endif %}
{% if disable_poe %}
 no power-over-ethernet
{% endif %}
{% if spanning_tree_edge %}
 spanning-tree edge-port
{% endif %}
{% if bpdu_guard %}
 spanning-tree bpdu-guard
{% endif %}
{% if speed %}
 speed {{ speed }}
{% endif %}
{% if duplex %}
 duplex {{ duplex }}
{% endif %}
{% if admin_up %}
 no disable
{% else %}
 disable
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port_range": {"type": "string", "description": "Port range (e.g. 1-24, A1-A24)"},
                "vlan_id": {"type": "string", "description": "Access VLAN ID"},
                "description": {"type": "string", "description": "Port description prefix"},
                "disable_poe": {"type": "boolean", "description": "Disable PoE on these ports"},
                "spanning_tree_edge": {"type": "boolean", "description": "Enable edge port"},
                "bpdu_guard": {"type": "boolean", "description": "Enable BPDU guard"},
                "speed": {"type": "string", "description": "Speed: auto, 10, 100, 1000"},
                "duplex": {"type": "string", "description": "Duplex: auto, half, full"},
                "admin_up": {"type": "boolean", "description": "Admin state: up (true) or down (false)"}
            },
            "required": ["port_range"]
        },
        "tags": "aruba,interface,range,bulk,l2",
        "is_builtin": True,
    },
    # --- PoE Configuration ---
    {
        "name": "Aruba - PoE Configuration",
        "description": "Configure Power over Ethernet on specific ports",
        "vendor": "aruba_os",
        "category": "poe",
        "template_body": """interface {{ port }}
{% if poe_enabled %}
 power-over-ethernet
{% if poe_priority %}
 power-over-ethernet priority {{ poe_priority }}
{% endif %}
{% if poe_max_watts %}
 power-over-ethernet max-watts {{ poe_max_watts }}
{% endif %}
{% else %}
 no power-over-ethernet
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port number"},
                "poe_enabled": {"type": "boolean", "description": "Enable PoE on this port"},
                "poe_priority": {"type": "string", "description": "PoE priority: critical, high, low"},
                "poe_max_watts": {"type": "string", "description": "Max wattage (e.g. 30, 60)"}
            },
            "required": ["port", "poe_enabled"]
        },
        "tags": "aruba,poe,power,interface",
        "is_builtin": True,
    },
    # --- Security Features ---
    {
        "name": "Aruba - Port Security (MAC Limit)",
        "description": "Configure port security with MAC address limiting and sticky MAC",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """interface {{ port }}
 name "{{ description | default('') }}"
!
# Port security
port-access {{ port_security_type | default('mac-based') }}
port-access max-clients {{ max_macs | default('1') }}
port-access violation {{ violation_action | default('shutdown') }}
{% if sticky_mac %}
port-access mac-address sticky
{% endif %}
!
# MAC address lockdown
{% if authorized_macs %}
{% for mac in authorized_macs %}
port-access mac-address {{ mac }}
{% endfor %}
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port number"},
                "description": {"type": "string", "description": "Port description"},
                "port_security_type": {"type": "string", "description": "Security type: mac-based, client-based"},
                "max_macs": {"type": "string", "description": "Maximum MAC addresses allowed"},
                "violation_action": {"type": "string", "description": "Violation action: shutdown, restrict, log"},
                "sticky_mac": {"type": "boolean", "description": "Enable sticky MAC learning"},
                "authorized_macs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of authorized MAC addresses"
                }
            },
            "required": ["port"]
        },
        "tags": "aruba,port-security,mac,security,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - 802.1X Port-Based Auth",
        "description": "Configure 802.1X port-based network access control",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """# Global 802.1X configuration
aaa authentication port-access radius
radius-server host {{ radius_primary }} key "{{ radius_secret }}"
{% if radius_secondary %}
radius-server host {{ radius_secondary }} key "{{ radius_secret }}"
{% endif %}
!
# Enable 802.1X on port
interface {{ port }}
 name "{{ description | default('') }}"
 aaa port-access authenticator
 aaa port-access authenticator timeout {{ timeout | default('30') }}
 aaa port-access authenticator max-requests {{ max_requests | default('2') }}
{% if guest_vlan %}
 aaa port-access authenticator guest-vlan {{ guest_vlan }}
{% endif %}
{% if unauth_vlan %}
 aaa port-access authenticator unauth-vlan {{ unauth_vlan }}
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port number"},
                "radius_primary": {"type": "string", "description": "Primary RADIUS server IP"},
                "radius_secondary": {"type": "string", "description": "Secondary RADIUS server IP"},
                "radius_secret": {"type": "string", "description": "RADIUS shared secret"},
                "description": {"type": "string", "description": "Port description"},
                "timeout": {"type": "string", "description": "Authentication timeout in seconds"},
                "max_requests": {"type": "string", "description": "Max authentication requests"},
                "guest_vlan": {"type": "string", "description": "Guest VLAN ID (optional)"},
                "unauth_vlan": {"type": "string", "description": "Unauthenticated VLAN ID (optional)"}
            },
            "required": ["port", "radius_primary", "radius_secret"]
        },
        "tags": "aruba,802.1x,port-security,authentication,security",
        "is_builtin": True,
    },
    {
        "name": "Aruba - DHCP Snooping",
        "description": "Configure DHCP snooping to prevent rogue DHCP servers",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """# Global DHCP snooping
dhcp-snooping
dhcp-snooping vlan {{ dhcp_vlans }}
dhcp-snooping database flash:/dhcp_snooping.db
!
# Trusted ports (uplink to DHCP server)
{% for trusted_port in trusted_ports %}
interface {{ trusted_port }}
 dhcp-snooping trust
 exit
{% endfor %}
!
# Rate limiting on untrusted ports
dhcp-snooping rate-limit {{ rate_limit | default('100') }}
""",
        "variables": {
            "type": "object",
            "properties": {
                "dhcp_vlans": {"type": "string", "description": "VLANs to protect (e.g. 10,20,30-40)"},
                "trusted_ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of trusted uplink ports"
                },
                "rate_limit": {"type": "string", "description": "DHCP packets per second limit"}
            },
            "required": ["dhcp_vlans", "trusted_ports"]
        },
        "tags": "aruba,dhcp-snooping,security,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Dynamic ARP Inspection",
        "description": "Configure Dynamic ARP Inspection (DAI) to prevent ARP spoofing",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """# Enable ARP inspection
arp-inspection
arp-inspection vlan {{ arp_vlans }}
!
# Trusted ports
{% for trusted_port in trusted_ports %}
interface {{ trusted_port }}
 arp-inspection trust
 exit
{% endfor %}
!
# Validate source MAC and IP
arp-inspection validate src-mac
arp-inspection validate dst-mac
arp-inspection validate ip
""",
        "variables": {
            "type": "object",
            "properties": {
                "arp_vlans": {"type": "string", "description": "VLANs to protect (e.g. 10,20,30-40)"},
                "trusted_ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of trusted uplink ports"
                }
            },
            "required": ["arp_vlans", "trusted_ports"]
        },
        "tags": "aruba,arp-inspection,dai,security,l2",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Storm Control",
        "description": "Configure broadcast, multicast, and unknown unicast storm control",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """interface {{ port }}
 name "{{ description | default('') }}"
!
# Storm control rates (percentage of link speed)
broadcast-limit {{ broadcast_pct | default('5') }}
multicast-limit {{ multicast_pct | default('10') }}
unknown-unicast-limit {{ unknown_ucast_pct | default('10') }}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port": {"type": "string", "description": "Port number"},
                "description": {"type": "string", "description": "Port description"},
                "broadcast_pct": {"type": "string", "description": "Broadcast limit % (default: 5)"},
                "multicast_pct": {"type": "string", "description": "Multicast limit % (default: 10)"},
                "unknown_ucast_pct": {"type": "string", "description": "Unknown unicast limit % (default: 10)"}
            },
            "required": ["port"]
        },
        "tags": "aruba,storm-control,broadcast,security,l2",
        "is_builtin": True,
    },
    # --- Spanning Tree ---
    {
        "name": "Aruba - Spanning Tree (RSTP/MSTP)",
        "description": "Configure Rapid Spanning Tree or Multiple Spanning Tree",
        "vendor": "aruba_os",
        "category": "stp",
        "template_body": """# Spanning Tree mode
spanning-tree
{% if stp_mode == 'mstp' %}
spanning-tree mst-configuration
 name "{{ mst_name | default('') }}"
 revision {{ mst_revision | default('1') }}
{% for instance in mst_instances %}
 instance {{ instance.id }} vlan {{ instance.vlans }}
{% endfor %}
 exit
spanning-tree force-version mstp
{% else %}
spanning-tree force-version rstp
{% endif %}
!
# Bridge priority
spanning-tree priority {{ bridge_priority | default('32768') }}
!
# Port-specific settings
{% for port_config in port_configs %}
interface {{ port_config.port }}
{% if port_config.edge %}
 spanning-tree edge-port
{% endif %}
{% if port_config.bpdu_guard %}
 spanning-tree bpdu-guard
{% endif %}
{% if port_config.root_guard %}
 spanning-tree root-guard
{% endif %}
{% if port_config.loop_guard %}
 spanning-tree loop-guard
{% endif %}
{% if port_config.path_cost %}
 spanning-tree path-cost {{ port_config.path_cost }}
{% endif %}
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "stp_mode": {"type": "string", "description": "STP mode: rstp or mstp"},
                "bridge_priority": {"type": "string", "description": "Bridge priority (0-61440, multiples of 4096)"},
                "mst_name": {"type": "string", "description": "MST region name"},
                "mst_revision": {"type": "string", "description": "MST revision number"},
                "mst_instances": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "MST instance ID"},
                            "vlans": {"type": "string", "description": "VLANs mapped to this instance"}
                        }
                    }
                },
                "port_configs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "port": {"type": "string", "description": "Port number"},
                            "edge": {"type": "boolean", "description": "Edge port (portfast)"},
                            "bpdu_guard": {"type": "boolean", "description": "BPDU guard"},
                            "root_guard": {"type": "boolean", "description": "Root guard"},
                            "loop_guard": {"type": "boolean", "description": "Loop guard"},
                            "path_cost": {"type": "string", "description": "Path cost override"}
                        }
                    }
                }
            },
            "required": ["stp_mode"]
        },
        "tags": "aruba,stp,rstp,mstp,spanning-tree,l2",
        "is_builtin": True,
    },
    # --- Routing ---
    {
        "name": "Aruba - Static Route",
        "description": "Configure a static route",
        "vendor": "aruba_os",
        "category": "routing",
        "template_body": """ip route {{ destination_network }} {{ destination_mask }} {{ next_hop }}
{% if distance %}
ip route {{ destination_network }} {{ destination_mask }} {{ next_hop }} distance {{ distance }}
{% endif %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "destination_network": {"type": "string", "description": "Destination network (e.g. 0.0.0.0 for default)"},
                "destination_mask": {"type": "string", "description": "Subnet mask (e.g. 0.0.0.0 for default)"},
                "next_hop": {"type": "string", "description": "Next hop IP address"},
                "distance": {"type": "string", "description": "Administrative distance (optional)"}
            },
            "required": ["destination_network", "destination_mask", "next_hop"]
        },
        "tags": "aruba,routing,static,l3",
        "is_builtin": True,
    },
    {
        "name": "Aruba - OSPF Configuration",
        "description": "Configure OSPF routing with network advertisements",
        "vendor": "aruba_os",
        "category": "routing",
        "template_body": """# Enable IP routing
ip routing
!
# OSPF configuration
router ospf
 router-id {{ router_id }}
{% for network in networks %}
 network {{ network.network }} {{ network.mask }} area {{ network.area | default('0.0.0.0') }}
{% endfor %}
{% if default_route %}
 default-information originate always
{% endif %}
{% if redistribute_static %}
 redistribute static
{% endif %}
 exit
!
# Interface OSPF settings
{% for intf_config in interface_configs %}
interface {{ intf_config.interface }}
 ip ospf {{ intf_config.ospf_process | default('') }}
{% if intf_config.cost %}
 ip ospf cost {{ intf_config.cost }}
{% endif %}
{% if intf_config.priority %}
 ip ospf priority {{ intf_config.priority }}
{% endif %}
{% if intf_config.passive %}
 ip ospf passive
{% endif %}
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "router_id": {"type": "string", "description": "OSPF router ID (IP address)"},
                "networks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "network": {"type": "string", "description": "Network address"},
                            "mask": {"type": "string", "description": "Subnet mask"},
                            "area": {"type": "string", "description": "OSPF area (default: 0.0.0.0)"}
                        }
                    },
                    "description": "Networks to advertise in OSPF"
                },
                "default_route": {"type": "boolean", "description": "Originate default route"},
                "redistribute_static": {"type": "boolean", "description": "Redistribute static routes"},
                "interface_configs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "interface": {"type": "string", "description": "Interface (e.g. vlan10, 1)"},
                            "ospf_process": {"type": "string", "description": "OSPF process"},
                            "cost": {"type": "string", "description": "Interface cost"},
                            "priority": {"type": "string", "description": "DR/BDR priority"},
                            "passive": {"type": "boolean", "description": "Passive interface"}
                        }
                    }
                }
            },
            "required": ["router_id", "networks"]
        },
        "tags": "aruba,ospf,routing,l3",
        "is_builtin": True,
    },
    {
        "name": "Aruba - VLAN Interface (SVI)",
        "description": "Configure a VLAN interface (SVI) with IP address for routing",
        "vendor": "aruba_os",
        "category": "routing",
        "template_body": """interface vlan{{ vlan_id }}
 name "{{ description | default('') }}"
 ip address {{ ip_address }} {{ subnet_mask }}
{% if vrrp_vrid %}
 ip vrrp vrid {{ vrrp_vrid }}
 ip vrrp vrid {{ vrrp_vrid }} primary-ip {{ vrrp_primary_ip }}
 ip vrrp vrid {{ vrrp_vrid }} priority {{ vrrp_priority | default('100') }}
{% endif %}
 exit
!
ip routing
""",
        "variables": {
            "type": "object",
            "properties": {
                "vlan_id": {"type": "string", "description": "VLAN ID"},
                "ip_address": {"type": "string", "description": "IP address for the VLAN interface"},
                "subnet_mask": {"type": "string", "description": "Subnet mask"},
                "description": {"type": "string", "description": "Interface description"},
                "vrrp_vrid": {"type": "string", "description": "VRRP virtual router ID (optional)"},
                "vrrp_primary_ip": {"type": "string", "description": "VRRP virtual IP address"},
                "vrrp_priority": {"type": "string", "description": "VRRP priority (default: 100)"}
            },
            "required": ["vlan_id", "ip_address", "subnet_mask"]
        },
        "tags": "aruba,vlan,svi,routing,l3",
        "is_builtin": True,
    },
    {
        "name": "Aruba - VRRP Configuration",
        "description": "Configure VRRP for gateway redundancy on a VLAN interface",
        "vendor": "aruba_os",
        "category": "routing",
        "template_body": """interface vlan{{ vlan_id }}
 ip vrrp vrid {{ vrid }}
 ip vrrp vrid {{ vrid }} primary-ip {{ virtual_ip }}
 ip vrrp vrid {{ vrid }} priority {{ priority | default('100') }}
{% if preempt %}
 ip vrrp vrid {{ vrid }} preempt
{% endif %}
 ip vrrp vrid {{ vrid }} advertisement-interval {{ advert_interval | default('1') }}
{% if track_vlan %}
 ip vrrp vrid {{ vrid }} track vlan {{ track_vlan }} priority {{ track_priority | default('20') }}
{% endif %}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "vlan_id": {"type": "string", "description": "VLAN ID"},
                "vrid": {"type": "string", "description": "VRRP virtual router ID (1-255)"},
                "virtual_ip": {"type": "string", "description": "Virtual IP address"},
                "priority": {"type": "string", "description": "Priority (1-254, default: 100)"},
                "preempt": {"type": "boolean", "description": "Enable preempt mode"},
                "advert_interval": {"type": "string", "description": "Advertisement interval in seconds"},
                "track_vlan": {"type": "string", "description": "VLAN to track for priority adjustment"},
                "track_priority": {"type": "string", "description": "Priority decrement when tracked VLAN is down"}
            },
            "required": ["vlan_id", "vrid", "virtual_ip"]
        },
        "tags": "aruba,vrrp,redundancy,routing,l3",
        "is_builtin": True,
    },
    # --- ACLs ---
    {
        "name": "Aruba - IPv4 ACL (Standard)",
        "description": "Create a standard IPv4 ACL with permit/deny entries",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """ip access-list standard "{{ acl_name }}"
{% for entry in entries %}
{% if entry.remark %}
 remark "{{ entry.remark }}"
{% endif %}
 {{ entry.action | default('permit') }} {{ entry.source }} {{ entry.source_mask | default('0.0.0.255') }}
{% endfor %}
 exit
!
# Apply to interface
interface {{ apply_interface }}
 ip access-group "{{ acl_name }}" {{ direction | default('in') }}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "acl_name": {"type": "string", "description": "ACL name"},
                "entries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string", "description": "permit or deny"},
                            "source": {"type": "string", "description": "Source network/host"},
                            "source_mask": {"type": "string", "description": "Source wildcard mask"},
                            "remark": {"type": "string", "description": "Optional remark"}
                        }
                    }
                },
                "apply_interface": {"type": "string", "description": "Interface to apply ACL to (e.g. vlan10, 1)"},
                "direction": {"type": "string", "description": "in or out"}
            },
            "required": ["acl_name", "entries", "apply_interface"]
        },
        "tags": "aruba,acl,security,access-control",
        "is_builtin": True,
    },
    {
        "name": "Aruba - IPv4 ACL (Extended)",
        "description": "Create an extended IPv4 ACL with protocol, port, and stateful inspection",
        "vendor": "aruba_os",
        "category": "security",
        "template_body": """ip access-list extended "{{ acl_name }}"
{% for entry in entries %}
{% if entry.remark %}
 remark "{{ entry.remark }}"
{% endif %}
 {{ entry.action | default('permit') }} {{ entry.protocol | default('ip') }} {{ entry.source }} {{ entry.source_mask | default('0.0.0.255') }} {{ entry.dest }} {{ entry.dest_mask | default('0.0.0.255') }}
{% if entry.dport %}
  {{ entry.dport }}
{% endif %}
{% if entry.established %}
  established
{% endif %}
{% endfor %}
 exit
!
# Apply to interface
interface {{ apply_interface }}
 ip access-group "{{ acl_name }}" {{ direction | default('in') }}
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "acl_name": {"type": "string", "description": "Extended ACL name"},
                "entries": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string", "description": "permit or deny"},
                            "protocol": {"type": "string", "description": "Protocol: ip, tcp, udp, icmp, etc."},
                            "source": {"type": "string", "description": "Source network/host"},
                            "source_mask": {"type": "string", "description": "Source wildcard mask"},
                            "dest": {"type": "string", "description": "Destination network/host"},
                            "dest_mask": {"type": "string", "description": "Destination wildcard mask"},
                            "dport": {"type": "string", "description": "Destination port (e.g. eq 80, range 100 200)"},
                            "established": {"type": "boolean", "description": "Match established connections"},
                            "remark": {"type": "string", "description": "Optional remark"}
                        }
                    }
                },
                "apply_interface": {"type": "string", "description": "Interface to apply ACL to"},
                "direction": {"type": "string", "description": "in or out"}
            },
            "required": ["acl_name", "entries", "apply_interface"]
        },
        "tags": "aruba,acl,extended,security,access-control",
        "is_builtin": True,
    },
    # --- Monitoring & Diagnostics ---
    {
        "name": "Aruba - sFlow Configuration",
        "description": "Configure sFlow for network traffic monitoring",
        "vendor": "aruba_os",
        "category": "monitoring",
        "template_body": """# sFlow configuration
sflow receiver {{ receiver_ip }} {{ receiver_port | default('6343') }}
sflow sampling {{ sampling_rate | default('512') }}
sflow polling {{ polling_interval | default('30') }}
sflow max-datagram-size {{ max_dgram | default('1400') }}
!
# Enable sFlow on interfaces
{% for port in monitored_ports %}
interface {{ port }}
 sflow enable
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "receiver_ip": {"type": "string", "description": "sFlow collector IP address"},
                "receiver_port": {"type": "string", "description": "sFlow collector port (default: 6343)"},
                "sampling_rate": {"type": "string", "description": "Packet sampling rate (default: 512)"},
                "polling_interval": {"type": "string", "description": "Polling interval in seconds (default: 30)"},
                "max_dgram": {"type": "string", "description": "Max datagram size (default: 1400)"},
                "monitored_ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports to monitor with sFlow"
                }
            },
            "required": ["receiver_ip", "monitored_ports"]
        },
        "tags": "aruba,sflow,monitoring,traffic",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Mirror Port (SPAN)",
        "description": "Configure port mirroring for traffic analysis",
        "vendor": "aruba_os",
        "category": "monitoring",
        "template_body": """# Port mirroring
mirror-port {{ monitor_port }}
!
# Mirror source ports (rx, tx, or both)
{% for source in source_ports %}
interface {{ source.port }}
 mirror {{ source.direction | default('both') }}
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "monitor_port": {"type": "string", "description": "Destination port for mirrored traffic"},
                "source_ports": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "port": {"type": "string", "description": "Source port to mirror"},
                            "direction": {"type": "string", "description": "both, rx, or tx"}
                        }
                    },
                    "description": "Source ports to mirror"
                }
            },
            "required": ["monitor_port", "source_ports"]
        },
        "tags": "aruba,monitoring,port-mirror,span",
        "is_builtin": True,
    },
    {
        "name": "Aruba - LLDP Configuration",
        "description": "Configure LLDP for neighbor discovery",
        "vendor": "aruba_os",
        "category": "management",
        "template_body": """# Global LLDP
lldp run
lldp transmit-interval {{ tx_interval | default('30') }}
lldp holdtime-multiplier {{ hold_mult | default('4') }}
lldp reinit-delay {{ reinit_delay | default('2') }}
!
# Enable LLDP on interfaces
{% for port in lldp_ports %}
interface {{ port }}
 lldp enable
 lldp transmit
 lldp receive
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "tx_interval": {"type": "string", "description": "LLDP transmit interval (default: 30)"},
                "hold_mult": {"type": "string", "description": "Holdtime multiplier (default: 4)"},
                "reinit_delay": {"type": "string", "description": "Reinitialization delay (default: 2)"},
                "lldp_ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports to enable LLDP on"
                }
            },
            "required": ["lldp_ports"]
        },
        "tags": "aruba,lldp,discovery,management",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Syslog & Logging",
        "description": "Configure syslog servers and logging levels",
        "vendor": "aruba_os",
        "category": "monitoring",
        "template_body": """# Syslog servers
logging {{ syslog_primary }}
{% if syslog_secondary %}
logging {{ syslog_secondary }}
{% endif %}
!
# Logging level
logging severity {{ log_severity | default('informational') }}
!
# Log to flash
logging flash {{ flash_severity | default('warnings') }}
!
# Include timestamp in logs
logging timestamp {{ ts_format | default('datetime') }}
""",
        "variables": {
            "type": "object",
            "properties": {
                "syslog_primary": {"type": "string", "description": "Primary syslog server IP"},
                "syslog_secondary": {"type": "string", "description": "Secondary syslog server IP (optional)"},
                "log_severity": {"type": "string", "description": "Log severity: emergencies, alerts, critical, errors, warnings, informational, debugging"},
                "flash_severity": {"type": "string", "description": "Flash log severity"},
                "ts_format": {"type": "string", "description": "Timestamp format: datetime, uptime, iso"}
            },
            "required": ["syslog_primary"]
        },
        "tags": "aruba,syslog,logging,monitoring",
        "is_builtin": True,
    },
    # --- VLAN Management ---
    {
        "name": "Aruba - Voice VLAN",
        "description": "Configure voice VLAN for VoIP phones (LLDP-MED)",
        "vendor": "aruba_os",
        "category": "vlan",
        "template_body": """# Voice VLAN configuration
vlan {{ voice_vlan_id }}
 name "{{ voice_vlan_name | default('VOICE') }}"
 exit
!
# Configure ports for voice + data
{% for port in voice_ports %}
interface {{ port }}
 name "{{ description | default('') }}"
 vlan access {{ data_vlan_id }}
 vlan voice {{ voice_vlan_id }}
{% if lldp_med %}
 lldp med
 lldp med-tlv-select power-management
{% endif %}
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "voice_vlan_id": {"type": "string", "description": "Voice VLAN ID"},
                "voice_vlan_name": {"type": "string", "description": "Voice VLAN name"},
                "data_vlan_id": {"type": "string", "description": "Data VLAN ID for access"},
                "voice_ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports for VoIP phones"
                },
                "description": {"type": "string", "description": "Port description prefix"},
                "lldp_med": {"type": "boolean", "description": "Enable LLDP-MED"}
            },
            "required": ["voice_vlan_id", "data_vlan_id", "voice_ports"]
        },
        "tags": "aruba,voice,vlan,voip,lldp",
        "is_builtin": True,
    },
    {
        "name": "Aruba - MAC VLAN Assignment",
        "description": "Assign VLAN based on MAC address (MAC-based VLAN)",
        "vendor": "aruba_os",
        "category": "vlan",
        "template_body": """# MAC-based VLAN assignment
{% for entry in mac_vlans %}
vlan {{ entry.vlan_id }}
 mac-vlan {{ entry.mac_address }}
 exit
{% endfor %}
!
# Enable MAC VLAN on ports
{% for port in mac_vlan_ports %}
interface {{ port }}
 vlan mac-vlan
 exit
{% endfor %}
""",
        "variables": {
            "type": "object",
            "properties": {
                "mac_vlans": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "mac_address": {"type": "string", "description": "MAC address (e.g. aabb.ccdd.eeff)"},
                            "vlan_id": {"type": "string", "description": "VLAN ID to assign"}
                        }
                    },
                    "description": "MAC-to-VLAN mappings"
                },
                "mac_vlan_ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Ports to enable MAC VLAN on"
                }
            },
            "required": ["mac_vlans", "mac_vlan_ports"]
        },
        "tags": "aruba,mac-vlan,vlan,l2",
        "is_builtin": True,
    },
    # --- Stacking ---
    {
        "name": "Aruba - Stacking (Backplane)",
        "description": "Configure switch stacking with member IDs and priority",
        "vendor": "aruba_os",
        "category": "management",
        "template_body": """# Stack member configuration
stack
 member {{ member_id }}
 type {{ switch_type }}
{% if stack_priority %}
 priority {{ stack_priority }}
{% endif %}
{% if stack_description %}
 description "{{ stack_description }}"
{% endif %}
 exit
!
# Stack management
stack
 auto-stack
 stack-name "{{ stack_name | default('') }}"
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "member_id": {"type": "string", "description": "Stack member ID (1-8)"},
                "switch_type": {"type": "string", "description": "Switch model type"},
                "stack_priority": {"type": "string", "description": "Stack member priority (1-255, higher = more likely commander)"},
                "stack_description": {"type": "string", "description": "Member description"},
                "stack_name": {"type": "string", "description": "Stack name"}
            },
            "required": ["member_id", "switch_type"]
        },
        "tags": "aruba,stacking,management",
        "is_builtin": True,
    },
    # --- Maintenance & Troubleshooting ---
    {
        "name": "Aruba - Firmware Upgrade",
        "description": "Upgrade switch firmware via TFTP or USB",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """# Copy firmware image to switch
copy {{ source_type | default('tftp') }}://{{ server_ip }}/{{ image_file }} flash:/{{ image_file }}
#
# Set primary image
boot system flash:/{{ image_file }}
#
# Save config and reboot
write memory
boot
""",
        "variables": {
            "type": "object",
            "properties": {
                "source_type": {"type": "string", "description": "Source type: tftp, usb"},
                "server_ip": {"type": "string", "description": "TFTP server IP address"},
                "image_file": {"type": "string", "description": "Firmware image filename"}
            },
            "required": ["server_ip", "image_file"]
        },
        "tags": "aruba,firmware,upgrade,maintenance",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Config Backup to TFTP",
        "description": "Backup running/startup config to TFTP server",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """# Backup running config
copy running-config tftp://{{ tftp_server }}/{{ hostname }}-running.cfg
#
# Backup startup config
copy startup-config tftp://{{ tftp_server }}/{{ hostname }}-startup.cfg
""",
        "variables": {
            "type": "object",
            "properties": {
                "tftp_server": {"type": "string", "description": "TFTP server IP address"},
                "hostname": {"type": "string", "description": "Switch hostname (for filename)"}
            },
            "required": ["tftp_server", "hostname"]
        },
        "tags": "aruba,backup,tftp,maintenance",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Config Restore from TFTP",
        "description": "Restore configuration from TFTP server",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """# Restore config from TFTP
copy tftp://{{ tftp_server }}/{{ config_file }} startup-config
#
# Apply and reload
boot
""",
        "variables": {
            "type": "object",
            "properties": {
                "tftp_server": {"type": "string", "description": "TFTP server IP address"},
                "config_file": {"type": "string", "description": "Config filename on TFTP server"}
            },
            "required": ["tftp_server", "config_file"]
        },
        "tags": "aruba,restore,tftp,maintenance",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Disable All Ports",
        "description": "Disable all data ports (for maintenance or security)",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """# Disable all ports (except management)
interface {{ port_range }}
 disable
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port_range": {"type": "string", "description": "Port range to disable (e.g. 1-48)"}
            },
            "required": ["port_range"]
        },
        "tags": "aruba,disable,ports,maintenance,security",
        "is_builtin": True,
    },
    {
        "name": "Aruba - Enable All Ports",
        "description": "Enable all data ports",
        "vendor": "aruba_os",
        "category": "maintenance",
        "template_body": """# Enable all ports
interface {{ port_range }}
 no disable
 exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "port_range": {"type": "string", "description": "Port range to enable (e.g. 1-48)"}
            },
            "required": ["port_range"]
        },
        "tags": "aruba,enable,ports,maintenance",
        "is_builtin": True,
    },
    # ===== CISCO IOS TEMPLATES (kept for multi-vendor support) =====
    {
        "name": "Cisco - VLAN Configuration",
        "description": "Create VLANs with names and optional descriptions",
        "vendor": "cisco_ios",
        "category": "vlan",
        "template_body": """vlan {{ vlan_id }}
 name {{ vlan_name }}
{% if vlan_description %}
 description {{ vlan_description }}
{% endif %}
exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "vlan_id": {"type": "string", "description": "VLAN ID (1-4094)"},
                "vlan_name": {"type": "string", "description": "VLAN name"},
                "vlan_description": {"type": "string", "description": "Optional description"}
            },
            "required": ["vlan_id", "vlan_name"]
        },
        "tags": "cisco,vlan,l2",
        "is_builtin": True,
    },
    {
        "name": "Cisco - Access Port",
        "description": "Set an interface to access mode on a specific VLAN",
        "vendor": "cisco_ios",
        "category": "interface",
        "template_body": """interface {{ interface }}
 switchport mode access
 switchport access vlan {{ vlan_id }}
{% if description %}
 description {{ description }}
{% endif %}
{% if spanning_tree_portfast %}
 spanning-tree portfast
{% endif %}
exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "interface": {"type": "string", "description": "Interface name"},
                "vlan_id": {"type": "string", "description": "Access VLAN ID"},
                "description": {"type": "string", "description": "Interface description"},
                "spanning_tree_portfast": {"type": "boolean", "description": "Enable portfast"}
            },
            "required": ["interface", "vlan_id"]
        },
        "tags": "cisco,interface,vlan,access,l2",
        "is_builtin": True,
    },
    {
        "name": "Cisco - Trunk Port",
        "description": "Configure a trunk interface with allowed VLANs",
        "vendor": "cisco_ios",
        "category": "interface",
        "template_body": """interface {{ interface }}
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk native vlan {{ native_vlan | default('1') }}
 switchport trunk allowed vlan {{ allowed_vlans }}
{% if description %}
 description {{ description }}
{% endif %}
exit
""",
        "variables": {
            "type": "object",
            "properties": {
                "interface": {"type": "string", "description": "Interface name"},
                "allowed_vlans": {"type": "string", "description": "Allowed VLANs (e.g. 10,20,30-40)"},
                "native_vlan": {"type": "string", "description": "Native VLAN ID (default: 1)"},
                "description": {"type": "string", "description": "Interface description"}
            },
            "required": ["interface", "allowed_vlans"]
        },
        "tags": "cisco,trunk,interface,vlan,l2",
        "is_builtin": True,
    },
    {
        "name": "Cisco - SSH & Management Access",
        "description": "Configure SSH, AAA, and management access settings",
        "vendor": "cisco_ios",
        "category": "security",
        "template_body": """hostname {{ hostname }}
!
ip domain-name {{ domain_name }}
!
crypto key generate rsa modulus {{ rsa_key_size | default('2048') }}
!
ip ssh version 2
ip ssh authentication-retries {{ ssh_retries | default('3') }}
ip ssh time-out {{ ssh_timeout | default('60') }}
!
line vty 0 {{ vty_end | default('15') }}
 transport input ssh
 login local
 exec-timeout {{ exec_timeout | default('10') }} 0
 exit
!
{% if enable_secret %}
enable secret {{ enable_secret }}
{% endif %}
!
username {{ admin_username }} privilege 15 secret {{ admin_password }}
!
service password-encryption
!
no ip http server
no ip http secure-server
""",
        "variables": {
            "type": "object",
            "properties": {
                "hostname": {"type": "string", "description": "Device hostname"},
                "domain_name": {"type": "string", "description": "Domain name"},
                "rsa_key_size": {"type": "string", "description": "RSA key size (default: 2048)"},
                "admin_username": {"type": "string", "description": "Admin username"},
                "admin_password": {"type": "string", "description": "Admin password"},
                "enable_secret": {"type": "string", "description": "Enable secret password"},
                "vty_end": {"type": "string", "description": "Last VTY line (default: 15)"},
                "ssh_retries": {"type": "string", "description": "SSH auth retries"},
                "ssh_timeout": {"type": "string", "description": "SSH timeout seconds"},
                "exec_timeout": {"type": "string", "description": "EXEC timeout minutes"}
            },
            "required": ["hostname", "domain_name", "admin_username", "admin_password"]
        },
        "tags": "cisco,ssh,security,management",
        "is_builtin": True,
    },
    {
        "name": "Cisco - Factory Reset",
        "description": "Complete factory reset: erase startup config and reload",
        "vendor": "cisco_ios",
        "category": "maintenance",
        "template_body": """# WARNING: This will erase ALL configuration and reload!
write erase
reload
""",
        "variables": {"type": "object", "properties": {}},
        "tags": "cisco,factory-reset,maintenance",
        "is_builtin": True,
    },
]


def seed_builtin_templates():
    """Seed built-in templates into the database if they don't exist."""
    db = SessionLocal()
    try:
        existing = db.query(ConfigTemplate).filter_by(is_builtin=True).count()
        if existing > 0:
            logger.info(f"Built-in templates already seeded ({existing} found)")
            # Normalize legacy double-encoded variables stored as JSON strings
            for t in db.query(ConfigTemplate).filter_by(is_builtin=True).all():
                if isinstance(t.variables, str):
                    try:
                        t.variables = json.loads(t.variables)
                    except (ValueError, TypeError):
                        pass
            db.commit()
            return

        for tmpl_data in BUILTIN_TEMPLATES:
            template = ConfigTemplate(
                name=tmpl_data["name"],
                description=tmpl_data["description"],
                vendor=tmpl_data["vendor"],
                category=tmpl_data["category"],
                template_body=tmpl_data["template_body"],
                variables=tmpl_data["variables"],
                tags=tmpl_data["tags"],
                is_builtin=True,
            )
            db.add(template)

        db.commit()
        logger.info(f"Seeded {len(BUILTIN_TEMPLATES)} built-in templates")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed built-in templates: {e}")
    finally:
        db.close()


def render_template(template_body: str, variables: dict) -> str:
    """Render a Jinja2 template with the given variables.

    Args:
        template_body: The Jinja2 template string
        variables: Dict of variable name -> value

    Returns:
        The rendered configuration text

    Raises:
        ValueError: If template rendering fails
    """
    try:
        # SandboxedEnvironment: template bodies are user-supplied, so block
        # access to Python internals (SSTI -> RCE via __class__/__mro__ etc.)
        env = SandboxedEnvironment()
        jinja_template = env.from_string(template_body)
        rendered = jinja_template.render(**variables)
        return rendered.strip()
    except UndefinedError as e:
        raise ValueError(f"Missing template variable: {e}")
    except TemplateError as e:
        raise ValueError(f"Template syntax error: {e}")
    except Exception as e:
        raise ValueError(f"Template rendering failed: {e}")


def apply_template_to_switch(switch_id: int, template_id: int, variables: dict) -> dict:
    """Render a template and return the config commands to apply.

    This does NOT push to the device — it returns the rendered config
    for review/approval before execution.
    """
    db = SessionLocal()
    try:
        from models import Switch
        switch = db.query(Switch).filter_by(id=switch_id).first()
        if not switch:
            return {"error": "Switch not found"}

        template = db.query(ConfigTemplate).filter_by(id=template_id).first()
        if not template:
            return {"error": "Template not found"}

        # Render the template
        rendered = render_template(template.template_body, variables)

        # Split into individual commands
        commands = [line.strip() for line in rendered.split("\n") if line.strip()]

        _log_audit("template_rendered", "template", template_id, "success", {
            "switch_id": switch_id,
            "template_name": template.name,
            "commands_count": len(commands),
        })

        return {
            "success": True,
            "template_name": template.name,
            "switch_hostname": switch.hostname,
            "rendered_config": rendered,
            "commands": commands,
            "command_count": len(commands),
        }
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Failed to apply template: {e}"}
    finally:
        db.close()


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

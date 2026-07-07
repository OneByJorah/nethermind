"""SQLAlchemy models for Hermes Switch Manager.

Models: Switch, ConfigBackup, ChatMessage, Workflow, WorkflowStep,
        AuditLog, SecurityFinding, ContainerlabTopology, DeviceMetric.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.sql import func
from database import Base


class Switch(Base):
    """Network switch device."""
    __tablename__ = "switches"

    id = Column(Integer, primary_key=True)
    hostname = Column(String(255), unique=True, nullable=False)
    ip_address = Column(String(45), nullable=False)
    vendor = Column(String(50), default="cisco_ios")  # cisco_ios, cisco_xr, juniper_junos, arista_eos, linux
    device_type = Column(String(50), default="cisco_ios")
    ssh_port = Column(Integer, default=22)
    ssh_username = Column(String(128), nullable=True)
    ssh_password = Column(String(256), nullable=True)
    snmp_community = Column(String(128), nullable=True)
    os_version = Column(String(128), nullable=True)
    serial_number = Column(String(64), nullable=True)
    location = Column(String(255), nullable=True)
    status = Column(String(20), default="unknown")  # unknown, online, offline, maintenance
    tags = Column(String(512), nullable=True, default="")
    notes = Column(Text, nullable=True)
    # Connection type: "ssh" (default) or "serial"
    connection_type = Column(String(10), default="ssh")
    # Serial port settings (used when connection_type = "serial")
    serial_port = Column(String(128), nullable=True)  # e.g. /dev/ttyUSB0, COM3
    serial_baud = Column(Integer, default=9600)
    serial_databits = Column(Integer, default=8)
    serial_parity = Column(String(1), default="N")  # N, E, O
    serial_stopbits = Column(Integer, default=1)
    serial_timeout = Column(Integer, default=10)
    serial_password = Column(String(256), nullable=True)  # enable password for serial
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ConfigBackup(Base):
    """Running/startup configuration backup."""
    __tablename__ = "config_backups"

    id = Column(Integer, primary_key=True)
    switch_id = Column(Integer, ForeignKey("switches.id"), nullable=False, index=True)
    config_type = Column(String(20), default="running")  # running, startup
    running_config = Column(Text, nullable=False)
    config_hash = Column(String(64), nullable=True)  # SHA-256 for change detection
    created_at = Column(DateTime, server_default=func.now())


class ConfigDiff(Base):
    """Stores diffs between config versions."""
    __tablename__ = "config_diffs"

    id = Column(Integer, primary_key=True)
    switch_id = Column(Integer, ForeignKey("switches.id"), nullable=False, index=True)
    from_backup_id = Column(Integer, ForeignKey("config_backups.id"), nullable=False)
    to_backup_id = Column(Integer, ForeignKey("config_backups.id"), nullable=False)
    diff_content = Column(Text, nullable=False)
    summary = Column(String(512), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ChatMessage(Base):
    """Chat history for Hermes AI agent sessions."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(128), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant, system, tool
    content = Column(Text, nullable=False)
    tool_calls = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Workflow(Base):
    """IRIS-style workflow for network changes."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="discover")  # discover, verify, propose, confirm, execute, verify_done, document, completed, failed
    switch_ids = Column(String(512), nullable=True)  # comma-separated switch IDs
    created_by = Column(String(128), nullable=True)
    approved_by = Column(String(128), nullable=True)
    ticket_ref = Column(String(128), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime, nullable=True)


class WorkflowStep(Base):
    """Individual steps within a workflow."""
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False, index=True)
    step_type = Column(String(50), nullable=False)  # discover, verify, propose, confirm, execute, document
    status = Column(String(20), default="pending")  # pending, running, completed, failed, rejected
    description = Column(String(512), nullable=True)
    command = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    requires_approval = Column(Boolean, default=True)
    approved = Column(Boolean, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    """Immutable audit trail for all state-changing actions."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    action = Column(String(128), nullable=False)  # config_backup, config_push, switch_add, workflow_execute, etc.
    actor = Column(String(128), nullable=True, default="system")
    target_type = Column(String(50), nullable=True)  # switch, config, workflow
    target_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    status = Column(String(20), default="success")  # success, failure, pending
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class SecurityFinding(Base):
    """Security audit findings — CVE, ACL, AAA, compliance."""
    __tablename__ = "security_findings"

    id = Column(Integer, primary_key=True)
    switch_id = Column(Integer, ForeignKey("switches.id"), nullable=False, index=True)
    finding_type = Column(String(50), nullable=False)  # cve, acl_vulnerability, aaa_misconfig, compliance, password_weakness, protocol_insecure
    severity = Column(String(20), default="medium")  # critical, high, medium, low, info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    cve_id = Column(String(20), nullable=True)
    affected_component = Column(String(128), nullable=True)
    status = Column(String(20), default="open")  # open, resolved, false_positive
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)


class ContainerlabTopology(Base):
    """Parsed Containerlab topology information."""
    __tablename__ = "containerlab_topologies"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    topology_data = Column(JSON, nullable=False)  # Full parsed topology JSON
    file_path = Column(String(512), nullable=True)
    node_count = Column(Integer, default=0)
    link_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    last_synced_at = Column(DateTime, nullable=True)


class DeviceMetric(Base):
    """Time-series device health metrics."""
    __tablename__ = "device_metrics"

    id = Column(Integer, primary_key=True)
    switch_id = Column(Integer, ForeignKey("switches.id"), nullable=False, index=True)
    cpu_usage = Column(Float, nullable=True)
    memory_usage = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    uptime_seconds = Column(Integer, nullable=True)
    interface_count = Column(Integer, nullable=True)
    interfaces_up = Column(Integer, nullable=True)
    interfaces_down = Column(Integer, nullable=True)
    recorded_at = Column(DateTime, server_default=func.now())


class ConfigTemplate(Base):
    """Pre-configured configuration templates for network devices."""
    __tablename__ = "config_templates"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    vendor = Column(String(50), default="cisco_ios")  # Target vendor
    category = Column(String(50), default="general")  # vlan, security, stp, interface, ospf, bgp, general
    template_body = Column(Text, nullable=False)  # Jinja2 template
    variables = Column(JSON, nullable=True)  # JSON schema of expected variables
    tags = Column(String(512), nullable=True, default="")
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

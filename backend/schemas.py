"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# ─── Switch ───

class SwitchCreate(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    ip_address: str = Field(..., min_length=7, max_length=45)
    vendor: str = "cisco_ios"
    device_type: Optional[str] = None
    ssh_port: int = 22
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[str] = ""
    notes: Optional[str] = None
    # Connection type
    connection_type: str = "ssh"  # "ssh" or "serial"
    # Serial settings
    serial_port: Optional[str] = None
    serial_baud: int = 9600
    serial_databits: int = 8
    serial_parity: str = "N"
    serial_stopbits: int = 1
    serial_timeout: int = 10
    serial_password: Optional[str] = None


class SwitchUpdate(BaseModel):
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    vendor: Optional[str] = None
    device_type: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_username: Optional[str] = None
    ssh_password: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    # Connection type
    connection_type: Optional[str] = None
    serial_port: Optional[str] = None
    serial_baud: Optional[int] = None
    serial_databits: Optional[int] = None
    serial_parity: Optional[str] = None
    serial_stopbits: Optional[int] = None
    serial_timeout: Optional[int] = None
    serial_password: Optional[str] = None


class SwitchOut(BaseModel):
    id: int
    hostname: str
    ip_address: str
    vendor: str
    device_type: Optional[str] = None
    ssh_port: int
    status: str
    os_version: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[str] = ""
    notes: Optional[str] = None
    connection_type: str = "ssh"
    serial_port: Optional[str] = None
    serial_baud: int = 9600
    serial_databits: int = 8
    serial_parity: str = "N"
    serial_stopbits: int = 1
    serial_timeout: int = 10
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Config ───

class ConfigBackupOut(BaseModel):
    id: int
    switch_id: int
    config_type: str
    running_config: str
    config_hash: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConfigDiffOut(BaseModel):
    id: int
    switch_id: int
    from_backup_id: int
    to_backup_id: int
    diff_content: str
    summary: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Chat ───

class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1)


class ChatMessageOut(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Workflow ───

class WorkflowCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    switch_ids: Optional[str] = None  # comma-separated
    created_by: Optional[str] = None
    ticket_ref: Optional[str] = None


class WorkflowAdvanceRequest(BaseModel):
    approved: bool = False
    result: Optional[str] = None


class WorkflowStepOut(BaseModel):
    id: int
    workflow_id: int
    step_type: str
    status: str
    description: Optional[str] = None
    command: Optional[str] = None
    result: Optional[str] = None
    requires_approval: bool = True
    approved: Optional[bool] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorkflowOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    switch_ids: Optional[str] = None
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    ticket_ref: Optional[str] = None
    steps: list[WorkflowStepOut] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Security ───

class SecurityFindingOut(BaseModel):
    id: int
    switch_id: int
    finding_type: str
    severity: str
    title: str
    description: Optional[str] = None
    remediation: Optional[str] = None
    cve_id: Optional[str] = None
    affected_component: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SecurityFindingUpdate(BaseModel):
    status: str = "resolved"  # resolved, false_positive


# ─── Containerlab ───

class ContainerlabTopologyOut(BaseModel):
    id: int
    name: str
    topology_data: Any
    file_path: Optional[str] = None
    node_count: int
    link_count: int
    is_active: bool
    created_at: datetime
    last_synced_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Metrics ───

class DeviceMetricOut(BaseModel):
    id: int
    switch_id: int
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    temperature: Optional[float] = None
    uptime_seconds: Optional[int] = None
    interface_count: Optional[int] = None
    interfaces_up: Optional[int] = None
    interfaces_down: Optional[int] = None
    recorded_at: datetime

    model_config = {"from_attributes": True}


# ─── Audit ───

class AuditLogOut(BaseModel):
    id: int
    action: str
    actor: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[Any] = None
    status: str
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Dashboard Stats ───

class DashboardStats(BaseModel):
    total_switches: int = 0
    online_switches: int = 0
    offline_switches: int = 0
    total_configs: int = 0
    open_security_findings: int = 0
    active_workflows: int = 0
    total_topologies: int = 0


# ─── Config Templates ───

class ConfigTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    vendor: str = "cisco_ios"
    category: str = "general"
    template_body: str = Field(..., min_length=1)
    variables: Optional[Any] = None
    tags: Optional[str] = ""


class ConfigTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    template_body: Optional[str] = None
    variables: Optional[Any] = None
    tags: Optional[str] = None


class ConfigTemplateOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    vendor: str
    category: str
    template_body: str
    variables: Optional[Any] = None
    tags: Optional[str] = ""
    is_builtin: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TemplateApplyRequest(BaseModel):
    template_id: int
    variables: dict[str, str] = {}

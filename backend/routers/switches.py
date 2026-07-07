"""Switch management endpoints.

CRUD operations for network switches, plus config backup and sync
supporting both SSH and serial console connections.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Switch, AuditLog
from services.netmiko_client import pull_running_config, check_health, execute_commands, bulk_backup_all
from services.serial_client import (
    pull_running_config_serial, check_health_serial,
    execute_commands_serial, push_config_serial, list_available_ports,
)
from services.template_engine import apply_template_to_switch
from schemas import SwitchCreate, SwitchUpdate, SwitchOut, TemplateApplyRequest

router = APIRouter(prefix="/api/switches", tags=["switches"])


def _get_connection_type(switch_id: int, db: Session) -> str:
    """Get the connection type for a switch."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")
    return sw.connection_type or "ssh"


@router.get("/", response_model=list[SwitchOut])
def list_switches(
    status: Optional[str] = None,
    vendor: Optional[str] = None,
    connection_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all switches with optional filtering."""
    query = db.query(Switch)
    if status:
        query = query.filter_by(status=status)
    if vendor:
        query = query.filter_by(vendor=vendor)
    if connection_type:
        query = query.filter_by(connection_type=connection_type)
    return query.order_by(Switch.hostname).all()


@router.post("/", response_model=SwitchOut, status_code=201)
def add_switch(data: SwitchCreate, db: Session = Depends(get_db)):
    """Add a new switch to the inventory."""
    # Check for duplicate hostname
    existing = db.query(Switch).filter_by(hostname=data.hostname).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Switch with hostname '{data.hostname}' already exists")

    sw = Switch(
        hostname=data.hostname,
        ip_address=data.ip_address,
        vendor=data.vendor,
        device_type=data.device_type or data.vendor,
        ssh_port=data.ssh_port,
        ssh_username=data.ssh_username,
        ssh_password=data.ssh_password,
        location=data.location,
        tags=data.tags,
        notes=data.notes,
        connection_type=data.connection_type,
        serial_port=data.serial_port,
        serial_baud=data.serial_baud,
        serial_databits=data.serial_databits,
        serial_parity=data.serial_parity,
        serial_stopbits=data.serial_stopbits,
        serial_timeout=data.serial_timeout,
        serial_password=data.serial_password,
    )
    db.add(sw)
    db.commit()
    db.refresh(sw)

    db.add(AuditLog(
        action="switch_add", actor="api",
        target_type="switch", target_id=sw.id,
        status="success", details={
            "hostname": sw.hostname, "ip": sw.ip_address,
            "connection_type": sw.connection_type,
        }
    ))
    db.commit()
    return sw


@router.get("/{switch_id}", response_model=SwitchOut)
def get_switch(switch_id: int, db: Session = Depends(get_db)):
    """Get details for a specific switch."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")
    return sw


@router.put("/{switch_id}", response_model=SwitchOut)
def update_switch(switch_id: int, data: SwitchUpdate, db: Session = Depends(get_db)):
    """Update switch attributes."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sw, key, value)

    db.commit()
    db.refresh(sw)

    db.add(AuditLog(
        action="switch_update", actor="api",
        target_type="switch", target_id=switch_id,
        status="success", details={"updated_fields": list(update_data.keys())}
    ))
    db.commit()
    return sw


@router.delete("/{switch_id}")
def delete_switch(switch_id: int, db: Session = Depends(get_db)):
    """Remove a switch from the inventory."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")
    db.delete(sw)
    db.commit()

    db.add(AuditLog(
        action="switch_delete", actor="api",
        target_type="switch", target_id=switch_id,
        status="success", details={}
    ))
    db.commit()
    return {"message": "Switch deleted"}


@router.post("/{switch_id}/sync")
def sync_config(switch_id: int, bg: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger a live config backup via SSH or serial for a switch."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")

    if sw.connection_type == "serial":
        bg.add_task(pull_running_config_serial, switch_id)
        return {
            "status": "sync_started",
            "hostname": sw.hostname,
            "connection_type": "serial",
            "message": "Serial config backup started in background",
        }
    else:
        bg.add_task(pull_running_config, switch_id)
        return {
            "status": "sync_started",
            "hostname": sw.hostname,
            "connection_type": "ssh",
            "message": "SSH config backup started in background",
        }


@router.post("/{switch_id}/health")
def health_check(switch_id: int, db: Session = Depends(get_db)):
    """Run a live health check on a switch (CPU, memory, interfaces)."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")

    if sw.connection_type == "serial":
        return check_health_serial(switch_id)
    return check_health(switch_id)


@router.post("/{switch_id}/commands")
def run_commands(switch_id: int, commands: list[str], db: Session = Depends(get_db)):
    """Execute read-only show commands on a switch."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")

    if sw.connection_type == "serial":
        return execute_commands_serial(switch_id, commands)
    return execute_commands(switch_id, commands)


@router.post("/{switch_id}/push-config")
def push_config(switch_id: int, commands: list[str], db: Session = Depends(get_db)):
    """Push configuration commands to a switch (state-changing, requires approval)."""
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")

    if sw.connection_type == "serial":
        return push_config_serial(switch_id, commands)
    # For SSH, use the existing push_config from netmiko_client
    from services.netmiko_client import push_config
    return push_config(switch_id, commands)


@router.post("/{switch_id}/apply-template")
def apply_template(
    switch_id: int,
    data: TemplateApplyRequest,
    db: Session = Depends(get_db),
):
    """Render a config template and prepare it for application to a switch.

    Returns the rendered config for review. Use the push-config endpoint
    to actually push the commands after approval.
    """
    sw = db.query(Switch).filter_by(id=switch_id).first()
    if not sw:
        raise HTTPException(status_code=404, detail="Switch not found")

    result = apply_template_to_switch(switch_id, data.template_id, data.variables)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/serial/ports")
def get_serial_ports():
    """List available serial ports on the system."""
    return list_available_ports()


@router.post("/bulk-backup")
def bulk_backup(bg: BackgroundTasks):
    """Trigger config backup for all online switches."""
    bg.add_task(bulk_backup_all)
    return {"status": "bulk_backup_started", "message": "Backup started for all online switches"}

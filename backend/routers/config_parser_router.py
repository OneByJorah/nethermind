"""Config Parser, Deployer, Upload & Backup API endpoints.

Upload a running-config .txt file -> get structured JSON back.
Backup a live switch's running config via SSH/Serial/Telnet.
Validate, render, and deploy configs.
"""
import hashlib
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from database import SessionLocal
from models import Switch, ConfigBackup, AuditLog
from services.config_parser import parse_config
from services.switch_config_model import SwitchConfig
from services.deployer import Deployer, render_config
from services.connection import ConnParams, Connection, PRIV_PROMPT, OPER_PROMPT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config-parser"])


# ─── Request Models ─────────────────────────────────────────────────────────

class DeployRequest(BaseModel):
    """Request to deploy a config to a switch."""
    config: dict
    transport: str = "telnet"
    host: str = "127.0.0.1"
    port: int = 9023
    username: str = "admin"
    password: str = ""
    serial_port: str = "COM3"
    baud: int = 9600


class RenderRequest(BaseModel):
    """Request to render a config to CLI text."""
    config: dict
    template: str = "arubaos_full_config.j2"


class BackupDirectRequest(BaseModel):
    """Request to backup a switch config directly (no DB switch record needed)."""
    transport: str = "ssh"
    host: str = ""
    port: int = 22
    username: str = "admin"
    password: str = ""
    serial_port: str = "COM3"
    baud: int = 9600
    save_to_db: bool = True
    switch_name: str = ""


class BackupByIdRequest(BaseModel):
    """Request to backup a switch that already exists in the database."""
    switch_id: int
    transport: str = "ssh"
    host: str = ""
    port: int = 22
    username: str = "admin"
    password: str = ""
    serial_port: str = "COM3"
    baud: int = 9600


# ─── Helper ─────────────────────────────────────────────────────────────────

def _clean_config_output(raw: str) -> str:
    """Remove command echo and prompt lines from switch output."""
    lines = raw.splitlines()
    clean = []
    for line in lines:
        s = line.strip()
        if s.startswith("show running-config"):
            continue
        if (s.endswith(">") or s.endswith("#")) and len(s) < 30:
            continue
        clean.append(line)
    return "\n".join(clean).strip() + "\n"


# ─── Parse ──────────────────────────────────────────────────────────────────

@router.post("/parse")
async def parse_uploaded_config(file: UploadFile = File(...)):
    """Upload a .txt running-config file and get structured JSON back."""
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="replace")
        cfg = parse_config(text)
        return {
            "success": True,
            "hostname": cfg.hostname,
            "role": cfg.role,
            "vlans": len(cfg.vlans),
            "config": cfg.to_dict(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {e}")


@router.post("/parse-text")
async def parse_config_text(body: dict):
    """Parse a running-config from raw text in the request body."""
    try:
        text = body.get("config", "")
        cfg = parse_config(text)
        return {
            "success": True,
            "hostname": cfg.hostname,
            "role": cfg.role,
            "vlans": len(cfg.vlans),
            "config": cfg.to_dict(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {e}")


# ─── Validate ───────────────────────────────────────────────────────────────

@router.post("/validate")
async def validate_config(body: dict):
    """Validate a SwitchConfig before deploying."""
    try:
        cfg = SwitchConfig.from_dict(body)
        errors = cfg.validate()
        return {"valid": len(errors) == 0, "errors": errors}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {e}")


# ─── Render ─────────────────────────────────────────────────────────────────

@router.post("/render")
async def render_config_endpoint(body: RenderRequest):
    """Render a SwitchConfig to ArubaOS-Switch CLI text."""
    try:
        cfg = SwitchConfig.from_dict(body.config)
        text = render_config(cfg, body.template)
        return {"success": True, "rendered": text, "line_count": len(text.splitlines())}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Render error: {e}")


# ─── Deploy ─────────────────────────────────────────────────────────────────

@router.post("/deploy")
async def deploy_config(body: DeployRequest):
    """Deploy a config to a switch via Serial/SSH/Telnet."""
    try:
        cfg = SwitchConfig.from_dict(body.config)
        errors = cfg.validate()
        if errors:
            raise HTTPException(status_code=400, detail={"errors": errors})

        params = ConnParams(
            transport=body.transport, host=body.host, port=body.port,
            username=body.username, password=body.password,
            serial_port=body.serial_port, baud=body.baud,
        )
        conn = Connection.build(params)
        deployer = Deployer(conn, progress=lambda s: logger.info(s))
        result = deployer.deploy(cfg)

        return {
            "success": result.success,
            "hostname_seen": result.hostname_seen,
            "lines_sent": result.lines_sent,
            "errors": result.errors,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy error: {e}")


# ─── Upload ─────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_config(file: UploadFile = File(...), save_to_db: bool = True):
    """Upload a .txt running-config file, parse it, and optionally save to DB.

    Returns the parsed config structure and stores it as a ConfigBackup.
    If the hostname doesn't match an existing switch, a new switch entry is created.
    """
    try:
        content_bytes = await file.read()
        text = content_bytes.decode("utf-8", errors="replace")
        cfg = parse_config(text)

        result = {
            "success": True,
            "filename": file.filename,
            "hostname": cfg.hostname,
            "role": cfg.role,
            "vlans": len(cfg.vlans),
            "config": cfg.to_dict(),
            "raw_config": text,
        }

        if save_to_db:
            db = SessionLocal()
            try:
                sw = db.query(Switch).filter_by(hostname=cfg.hostname).first() if cfg.hostname else None
                if not sw:
                    sw = Switch(
                        hostname=cfg.hostname or file.filename.replace(".txt", ""),
                        ip_address="0.0.0.0",
                        vendor="aruba_os",
                        status="unknown",
                        notes=f"Auto-created from uploaded config: {file.filename}",
                    )
                    db.add(sw)
                    db.commit()
                    db.refresh(sw)

                config_hash = hashlib.sha256(text.encode()).hexdigest()
                backup = ConfigBackup(
                    switch_id=sw.id, config_type="uploaded",
                    running_config=text, config_hash=config_hash,
                )
                db.add(backup)
                db.commit()
                db.refresh(backup)

                result["switch_id"] = sw.id
                result["backup_id"] = backup.id
                result["saved_to_db"] = True

                db.add(AuditLog(
                    action="config_upload", actor="api",
                    target_type="switch", target_id=sw.id,
                    status="success",
                    details={"filename": file.filename, "hostname": cfg.hostname},
                ))
                db.commit()
            finally:
                db.close()

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload/parse error: {e}")


# ─── Backup (direct) ────────────────────────────────────────────────────────

@router.post("/backup")
async def backup_switch_config(body: BackupDirectRequest):
    """Connect to a live switch, pull running config, and save to DB.

    Supports SSH (Netmiko), serial (pyserial), and Telnet transports.
    If save_to_db=true, creates/updates the switch and stores the config backup.
    """
    try:
        params = ConnParams(
            transport=body.transport, host=body.host, port=body.port,
            username=body.username, password=body.password,
            serial_port=body.serial_port, baud=body.baud,
        )

        logger.info(f"Connecting to {body.host} via {body.transport}...")
        conn = Connection.build(params)
        conn.connect()
        conn.read_until(PRIV_PROMPT + "|" + OPER_PROMPT, timeout=8.0)

        logger.info("Pulling running config...")
        conn.send_line("show running-config", delay=2.0)
        config_text = conn.read_until(PRIV_PROMPT, timeout=30.0)
        config_text = _clean_config_output(config_text)
        conn.close()

        cfg = parse_config(config_text)
        hostname = cfg.hostname or body.switch_name or body.host

        result = {
            "success": True,
            "hostname": hostname,
            "transport": body.transport,
            "host": body.host,
            "line_count": len(config_text.splitlines()),
            "config": cfg.to_dict(),
            "raw_config": config_text,
        }

        if body.save_to_db:
            db = SessionLocal()
            try:
                sw = db.query(Switch).filter_by(hostname=hostname).first()
                if not sw:
                    sw = Switch(
                        hostname=hostname, ip_address=body.host,
                        vendor="aruba_os", status="online",
                        connection_type=body.transport,
                    )
                    db.add(sw)
                    db.commit()
                    db.refresh(sw)

                config_hash = hashlib.sha256(config_text.encode()).hexdigest()
                backup = ConfigBackup(
                    switch_id=sw.id, config_type="running",
                    running_config=config_text, config_hash=config_hash,
                )
                db.add(backup)
                sw.status = "online"
                db.commit()
                db.refresh(backup)

                result["switch_id"] = sw.id
                result["backup_id"] = backup.id
                result["saved_to_db"] = True

                db.add(AuditLog(
                    action="config_backup", actor="api",
                    target_type="switch", target_id=sw.id,
                    status="success",
                    details={"transport": body.transport, "host": body.host},
                ))
                db.commit()
            finally:
                db.close()

        return result
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Backup error: {e}")


# ─── Backup (by switch ID) ──────────────────────────────────────────────────

@router.post("/backup-by-id")
async def backup_switch_by_id(body: BackupByIdRequest):
    """Backup a switch that already exists in the database by its switch_id.

    Uses the switch's stored connection details (SSH/serial settings).
    """
    db = SessionLocal()
    try:
        sw = db.query(Switch).filter_by(id=body.switch_id).first()
        if not sw:
            raise HTTPException(status_code=404, detail="Switch not found")
        hostname = sw.hostname
        transport = body.transport or sw.connection_type or "ssh"
        host = body.host or sw.ip_address
        port = body.port or (sw.ssh_port if transport == "ssh" else 23)
        username = body.username or sw.ssh_username or "admin"
        password = body.password or sw.ssh_password or ""
        serial_port = body.serial_port or sw.serial_port or "COM3"
        baud = body.baud or sw.serial_baud or 9600
    finally:
        db.close()

    params = ConnParams(
        transport=transport, host=host, port=port,
        username=username, password=password,
        serial_port=serial_port, baud=baud,
    )

    try:
        logger.info(f"Backing up {hostname} ({host}) via {transport}...")
        conn = Connection.build(params)
        conn.connect()
        conn.read_until(PRIV_PROMPT + "|" + OPER_PROMPT, timeout=8.0)

        conn.send_line("show running-config", delay=2.0)
        config_text = conn.read_until(PRIV_PROMPT, timeout=30.0)
        config_text = _clean_config_output(config_text)
        conn.close()

        db = SessionLocal()
        try:
            config_hash = hashlib.sha256(config_text.encode()).hexdigest()
            backup = ConfigBackup(
                switch_id=body.switch_id, config_type="running",
                running_config=config_text, config_hash=config_hash,
            )
            db.add(backup)
            db.query(Switch).filter_by(id=body.switch_id).update({"status": "online"})
            db.commit()
            db.refresh(backup)

            db.add(AuditLog(
                action="config_backup", actor="api",
                target_type="switch", target_id=body.switch_id,
                status="success",
                details={"transport": transport, "host": host, "backup_id": backup.id},
            ))
            db.commit()

            return {
                "success": True,
                "switch_id": body.switch_id,
                "backup_id": backup.id,
                "hostname": hostname,
                "line_count": len(config_text.splitlines()),
                "config_hash": config_hash,
            }
        finally:
            db.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Backup failed for switch {body.switch_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Backup error: {e}")

"""Config Parser & Deployer API endpoints.

Upload a running-config .txt file → get structured JSON back.
Validate a config before deploying.
Push a config to a switch via Serial/SSH/Telnet.
"""
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from services.config_parser import parse_config
from services.switch_config_model import SwitchConfig
from services.deployer import Deployer, render_config
from services.connection import ConnParams, Connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config-parser"])


class DeployRequest(BaseModel):
    """Request to deploy a config to a switch."""
    config: dict  # SwitchConfig as dict
    transport: str = "telnet"  # serial, ssh, telnet
    host: str = "127.0.0.1"
    port: int = 9023
    username: str = "admin"
    password: str = ""
    serial_port: str = "COM3"
    baud: int = 9600


class RenderRequest(BaseModel):
    """Request to render a config to CLI text."""
    config: dict  # SwitchConfig as dict
    template: str = "arubaos_full_config.j2"


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


@router.post("/validate")
async def validate_config(body: dict):
    """Validate a SwitchConfig before deploying."""
    try:
        cfg = SwitchConfig.from_dict(body)
        errors = cfg.validate()
        return {
            "valid": len(errors) == 0,
            "errors": errors,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {e}")


@router.post("/render")
async def render_config_endpoint(body: RenderRequest):
    """Render a SwitchConfig to ArubaOS-Switch CLI text."""
    try:
        cfg = SwitchConfig.from_dict(body.config)
        text = render_config(cfg, body.template)
        return {
            "success": True,
            "rendered": text,
            "line_count": len(text.splitlines()),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Render error: {e}")


@router.post("/deploy")
async def deploy_config(body: DeployRequest):
    """Deploy a config to a switch via Serial/SSH/Telnet.

    WARNING: This is a state-changing operation that pushes config to a live switch.
    """
    try:
        cfg = SwitchConfig.from_dict(body.config)
        errors = cfg.validate()
        if errors:
            raise HTTPException(status_code=400, detail={"errors": errors})

        params = ConnParams(
            transport=body.transport,
            host=body.host,
            port=body.port,
            username=body.username,
            password=body.password,
            serial_port=body.serial_port,
            baud=body.baud,
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

"""Configuration template management endpoints.

CRUD operations for config templates, plus template rendering and
application to switches.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from database import get_db
from models import ConfigTemplate, AuditLog
from schemas import (
    ConfigTemplateCreate, ConfigTemplateUpdate, ConfigTemplateOut,
    TemplateApplyRequest,
)
from services.template_engine import (
    render_template, apply_template_to_switch, seed_builtin_templates,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/", response_model=list[ConfigTemplateOut])
def list_templates(
    vendor: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all config templates with optional filtering."""
    query = db.query(ConfigTemplate)
    if vendor:
        query = query.filter_by(vendor=vendor)
    if category:
        query = query.filter_by(category=category)
    return query.order_by(ConfigTemplate.name).all()


@router.post("/", response_model=ConfigTemplateOut, status_code=201)
def create_template(data: ConfigTemplateCreate, db: Session = Depends(get_db)):
    """Create a new configuration template."""
    # Validate template syntax by trying to render with empty vars
    try:
        render_template(data.template_body, {})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Template syntax error: {e}")

    tmpl = ConfigTemplate(
        name=data.name,
        description=data.description,
        vendor=data.vendor,
        category=data.category,
        template_body=data.template_body,
        variables=data.variables,
        tags=data.tags,
        is_builtin=False,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)

    db.add(AuditLog(
        action="template_create", actor="api",
        target_type="template", target_id=tmpl.id,
        status="success", details={"name": tmpl.name, "vendor": tmpl.vendor}
    ))
    db.commit()

    return tmpl


@router.get("/{template_id}", response_model=ConfigTemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """Get a specific template by ID."""
    tmpl = db.query(ConfigTemplate).filter_by(id=template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl


@router.put("/{template_id}", response_model=ConfigTemplateOut)
def update_template(template_id: int, data: ConfigTemplateUpdate, db: Session = Depends(get_db)):
    """Update a template."""
    tmpl = db.query(ConfigTemplate).filter_by(id=template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tmpl.is_builtin:
        raise HTTPException(status_code=403, detail="Built-in templates cannot be modified")

    update_data = data.model_dump(exclude_unset=True)

    # Validate template syntax if body changed
    if "template_body" in update_data:
        try:
            render_template(update_data["template_body"], {})
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Template syntax error: {e}")

    # Normalize legacy double-encoded variables (stored as JSON strings)
    if "variables" in update_data and isinstance(update_data["variables"], str):
        try:
            update_data["variables"] = json.loads(update_data["variables"])
        except (ValueError, TypeError):
            pass

    for key, value in update_data.items():
        setattr(tmpl, key, value)

    db.commit()
    db.refresh(tmpl)

    db.add(AuditLog(
        action="template_update", actor="api",
        target_type="template", target_id=template_id,
        status="success", details={"updated_fields": list(update_data.keys())}
    ))
    db.commit()

    return tmpl


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a template."""
    tmpl = db.query(ConfigTemplate).filter_by(id=template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tmpl.is_builtin:
        raise HTTPException(status_code=403, detail="Built-in templates cannot be deleted")

    db.delete(tmpl)
    db.commit()

    db.add(AuditLog(
        action="template_delete", actor="api",
        target_type="template", target_id=template_id,
        status="success", details={}
    ))
    db.commit()

    return {"message": "Template deleted"}


@router.post("/render")
def render_template_endpoint(data: TemplateApplyRequest, db: Session = Depends(get_db)):
    """Render a template with variables (without applying to a switch)."""
    tmpl = db.query(ConfigTemplate).filter_by(id=data.template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        rendered = render_template(tmpl.template_body, data.variables)
        commands = [line.strip() for line in rendered.split("\n") if line.strip()]
        return {
            "success": True,
            "template_name": tmpl.name,
            "rendered_config": rendered,
            "commands": commands,
            "command_count": len(commands),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/apply/{switch_id}")
def apply_template_to_switch_endpoint(
    switch_id: int,
    data: TemplateApplyRequest,
    db: Session = Depends(get_db),
):
    """Render a template and prepare it for application to a switch.

    Returns the rendered config for review. Use the switches API
    to actually push the commands.
    """
    result = apply_template_to_switch(switch_id, data.template_id, data.variables)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/seed")
def seed_templates():
    """Seed built-in templates into the database."""
    seed_builtin_templates()
    return {"message": "Built-in templates seeded"}

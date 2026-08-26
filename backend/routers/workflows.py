"""Workflow engine endpoints.

IRIS-inspired operational workflow: Discover → Verify → Propose → Confirm → Execute → Verify → Document.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Workflow, WorkflowStep
from schemas import WorkflowCreate, WorkflowOut, WorkflowStepOut, WorkflowAdvanceRequest
from services.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.post("/", response_model=WorkflowOut)
def create_workflow(data: WorkflowCreate, db: Session = Depends(get_db)):
    """Create a new network change workflow."""
    engine = WorkflowEngine(db)
    wf = engine.create(data)
    wf.steps = db.query(WorkflowStep).filter_by(workflow_id=wf.id).order_by(WorkflowStep.created_at).all()
    return wf


@router.get("/", response_model=list[WorkflowOut])
def list_workflows(status: str = None, db: Session = Depends(get_db)):
    """List all workflows, optionally filtered by status."""
    engine = WorkflowEngine(db)
    workflows = engine.list_all(status)
    for wf in workflows:
        wf.steps = db.query(WorkflowStep).filter_by(workflow_id=wf.id).order_by(WorkflowStep.created_at).all()
    return workflows


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """Get a specific workflow with all its steps."""
    engine = WorkflowEngine(db)
    wf = engine.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


@router.post("/{workflow_id}/advance")
def advance_workflow(
    workflow_id: int,
    data: WorkflowAdvanceRequest | None = None,
    approved: bool = False,
    result: str = None,
    db: Session = Depends(get_db),
):
    """Advance the workflow to the next step (with optional approval).

    Accepts either a JSON body {"approved": bool, "result": str} or
    legacy query parameters.
    """
    engine = WorkflowEngine(db)
    if data is not None:
        approved = data.approved
        result = data.result
    result_data = engine.advance(workflow_id, approved=approved, result=result)
    if "error" in result_data:
        raise HTTPException(status_code=400, detail=result_data["error"])
    return result_data


@router.post("/{workflow_id}/steps/{step_id}/execute")
def execute_step(workflow_id: int, step_id: int, db: Session = Depends(get_db)):
    """Execute the automation logic for a specific workflow step.

    For 'discover' steps, this pulls live configs.
    For 'verify' steps, this runs health checks.
    """
    engine = WorkflowEngine(db)
    result = engine.execute_step(workflow_id, step_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """Delete a workflow."""
    wf = db.query(Workflow).filter_by(id=workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    # Delete steps first
    db.query(WorkflowStep).filter_by(workflow_id=workflow_id).delete()
    db.delete(wf)
    db.commit()
    return {"message": "Workflow deleted"}

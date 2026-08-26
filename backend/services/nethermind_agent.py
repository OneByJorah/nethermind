"""Nethermind AI Agent — OpenAI-powered network assistant with tool calling.

Integrates with the network environment via tools: get_switch_list,
get_switch_config, run_switch_command, get_health, get_security_findings,
get_audit_logs, and diff_configs.
"""
import json
from typing import Optional
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from models import Switch, ConfigBackup, ChatMessage, SecurityFinding, AuditLog, DeviceMetric
from services.netmiko_client import pull_running_config, execute_commands, check_health


def _get_client() -> AsyncOpenAI:
    """Lazy-initialize the OpenAI client to allow app startup without API key."""
    if not settings.OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY is not set. Please add it to your .env file "
            "or set the OPENAI_API_KEY environment variable."
        )
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

SYSTEM_PROMPT = """You are Nethermind, an expert network engineer AI assistant. You help manage, troubleshoot, and configure network switches and devices.

You have access to tools that let you interact with real network devices. Always use tools to get live data rather than making assumptions.

Guidelines:
- Show configuration outputs in markdown code blocks.
- When troubleshooting, follow OSI layer methodology.
- Always verify before and after making changes.
- For state-changing operations, present the full plan to the user and wait for explicit approval.
- Be concise but thorough in your analysis.
- Use network engineering best practices.
- When analyzing security findings, prioritize critical and high severity issues first.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_switch_list",
            "description": "List all managed switches with their status, vendor, and IP",
            "parameters": {
                "type": "object",
                "properties": {
                    "status_filter": {
                        "type": "string",
                        "description": "Optional filter: online, offline, unknown",
                        "enum": ["online", "offline", "unknown", "all"]
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_switch_config",
            "description": "Get the most recent running config backup for a switch",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Switch ID"},
                    "truncate": {"type": "integer", "description": "Optional: truncate config to N chars"}
                },
                "required": ["switch_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_switch_command",
            "description": "Execute a read-only show command on a switch via SSH",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Switch ID"},
                    "command": {"type": "string", "description": "Show command to run (e.g., 'show ip route', 'show interfaces')"}
                },
                "required": ["switch_id", "command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "pull_live_config",
            "description": "SSH into a switch and pull a fresh running config immediately",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Switch ID"}
                },
                "required": ["switch_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_switch_health",
            "description": "Get real-time health metrics (CPU, memory, interfaces) for a switch",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Switch ID"}
                },
                "required": ["switch_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_security_findings",
            "description": "Get security audit findings for all switches or a specific switch",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Optional: filter by switch ID"},
                    "severity": {"type": "string", "description": "Optional: filter by severity (critical, high, medium, low, info)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "diff_configs",
            "description": "Compare two config backup versions and return the diff",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Switch ID"},
                    "backup_id_a": {"type": "integer", "description": "First backup ID (older)"},
                    "backup_id_b": {"type": "integer", "description": "Second backup ID (newer)"}
                },
                "required": ["switch_id", "backup_id_a", "backup_id_b"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_audit_logs",
            "description": "Get recent audit log entries for a switch or all recent activity",
            "parameters": {
                "type": "object",
                "properties": {
                    "switch_id": {"type": "integer", "description": "Optional: filter by switch ID"},
                    "limit": {"type": "integer", "description": "Number of entries to return (default 20)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_network_dashboard",
            "description": "Get a summary of the entire network: online/offline counts, recent events, and top issues",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
]


async def call_tool(name: str, args: dict) -> str:
    """Execute a tool call and return the result as a string."""
    db = SessionLocal()
    try:
        if name == "get_switch_list":
            status_filter = args.get("status_filter", "all")
            query = db.query(Switch)
            if status_filter != "all":
                query = query.filter_by(status=status_filter)
            switches = query.all()
            return json.dumps([
                {"id": s.id, "hostname": s.hostname, "ip": s.ip_address,
                 "vendor": s.vendor, "status": s.status, "location": s.location,
                 "os_version": s.os_version}
                for s in switches
            ], indent=2)

        elif name == "get_switch_config":
            switch_id = args["switch_id"]
            backup = db.query(ConfigBackup).filter_by(switch_id=switch_id)\
                .order_by(ConfigBackup.created_at.desc()).first()
            if not backup:
                return json.dumps({"error": "No config found for this switch"})
            config = backup.running_config
            truncate = args.get("truncate", 0)
            if truncate and len(config) > truncate:
                config = config[:truncate] + "\n\n... [truncated]"
            return json.dumps({
                "backup_id": backup.id,
                "config_hash": backup.config_hash,
                "timestamp": str(backup.created_at),
                "config": config
            }, indent=2)

        elif name == "run_switch_command":
            switch_id = args["switch_id"]
            command = args["command"]
            switch = db.query(Switch).filter_by(id=switch_id).first()
            if not switch:
                return json.dumps({"error": "Switch not found"})
            result = execute_commands(switch_id, [command])
            return json.dumps(result, indent=2)

        elif name == "pull_live_config":
            switch_id = args["switch_id"]
            result = pull_running_config(switch_id)
            return json.dumps(result, indent=2)

        elif name == "get_switch_health":
            switch_id = args["switch_id"]
            result = check_health(switch_id)
            return json.dumps(result, indent=2)

        elif name == "get_security_findings":
            query = db.query(SecurityFinding)
            if "switch_id" in args:
                query = query.filter_by(switch_id=args["switch_id"])
            if "severity" in args:
                query = query.filter_by(severity=args["severity"])
            findings = query.order_by(SecurityFinding.created_at.desc()).limit(50).all()
            return json.dumps([
                {"id": f.id, "switch_id": f.switch_id, "type": f.finding_type,
                 "severity": f.severity, "title": f.title, "cve_id": f.cve_id,
                 "status": f.status, "created_at": str(f.created_at)}
                for f in findings
            ], indent=2)

        elif name == "diff_configs":
            switch_id = args["switch_id"]
            ba = db.query(ConfigBackup).filter_by(id=args["backup_id_a"]).first()
            bb = db.query(ConfigBackup).filter_by(id=args["backup_id_b"]).first()
            if not ba or not bb:
                return json.dumps({"error": "One or both backups not found"})
            import difflib
            diff = difflib.unified_diff(
                ba.running_config.splitlines(keepends=True),
                bb.running_config.splitlines(keepends=True),
                fromfile=f"Backup {ba.id} ({ba.created_at})",
                tofile=f"Backup {bb.id} ({bb.created_at})"
            )
            return "".join(diff)

        elif name == "get_audit_logs":
            query = db.query(AuditLog)
            if "switch_id" in args:
                query = query.filter_by(target_id=args["switch_id"], target_type="switch")
            limit = args.get("limit", 20)
            logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
            return json.dumps([
                {"action": l.action, "status": l.status, "details": l.details,
                 "created_at": str(l.created_at)}
                for l in logs
            ], indent=2)

        elif name == "get_network_dashboard":
            total = db.query(Switch).count()
            online = db.query(Switch).filter_by(status="online").count()
            offline = db.query(Switch).filter_by(status="offline").count()
            configs_count = db.query(ConfigBackup).count()
            open_findings = db.query(SecurityFinding).filter_by(status="open").count()
            recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5).all()
            return json.dumps({
                "total_switches": total,
                "online": online,
                "offline": offline,
                "total_config_backups": configs_count,
                "open_security_findings": open_findings,
                "recent_activity": [
                    {"action": l.action, "status": l.status, "time": str(l.created_at)}
                    for l in recent_logs
                ]
            }, indent=2)

        return json.dumps({"error": f"Unknown tool: {name}"})
    finally:
        db.close()


async def ask(session_id: str, message: str):
    """Process a chat message with streaming response and tool calling."""
    from fastapi.responses import StreamingResponse

    async def generate():
        # Load chat history
        db = SessionLocal()
        try:
            history = db.query(ChatMessage).filter_by(session_id=session_id)\
                .order_by(ChatMessage.created_at).limit(50).all()
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for h in history:
                messages.append({"role": h.role, "content": h.content})

            # Save user message
            db.add(ChatMessage(session_id=session_id, role="user", content=message))
            db.commit()

            # First pass — get assistant response + possible tool calls
            messages.append({"role": "user", "content": message})
            openai_client = _get_client()
            response = await openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                tools=TOOLS,
                stream=True,
                stream_options={"include_usage": True},
            )

            tool_calls = {}
            collected_content = ""

            async for chunk in response:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                if delta.content:
                    collected_content += delta.content
                    yield f"data: {json.dumps({'token': delta.content})}\n\n"

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls:
                            tool_calls[idx] = {"id": "", "function": {"name": "", "arguments": ""}}
                        if tc.id:
                            tool_calls[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            tool_calls[idx]["function"]["name"] += tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls[idx]["function"]["arguments"] += tc.function.arguments

            # Save assistant response
            if collected_content:
                db.add(ChatMessage(
                    session_id=session_id, role="assistant",
                    content=collected_content,
                    tool_calls=[tc for tc in tool_calls.values()] if tool_calls else None
                ))
                db.commit()

            # Execute tool calls if any
            if tool_calls:
                tool_msg = '\n\n🔧 **Executing tools...**\n\n'
                yield f"data: {json.dumps({'token': tool_msg})}\n\n"
                tool_results = []
                for idx in sorted(tool_calls.keys()):
                    tc = tool_calls[idx]
                    try:
                        args = json.loads(tc["function"]["arguments"])
                        result = await call_tool(tc["function"]["name"], args)
                        tool_results.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": result
                        })
                        # Show truncated result
                        display = result[:1500] + "..." if len(result) > 1500 else result
                        tool_out = f'⚙️ **{tc["function"]["name"]}** →\n```\n{display}\n```\n\n'
                        yield f"data: {json.dumps({'token': tool_out})}\n\n"
                    except Exception as e:
                        err_out = f'❌ Tool error: {e}\n\n'
                        yield f"data: {json.dumps({'token': err_out})}\n\n"

                # Final pass — get final response with tool results
                messages.append({"role": "assistant", "content": collected_content, "tool_calls": [tc for tc in tool_calls.values()]})
                messages.extend(tool_results)

                openai_client = _get_client()
                final_response = await openai_client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=messages,
                    stream=True,
                )

                final_content = ""
                async for chunk in final_response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        final_content += token
                        yield f"data: {json.dumps({'token': token})}\n\n"

                # Save final response
                if final_content:
                    db.add(ChatMessage(
                        session_id=session_id, role="assistant",
                        content=f"{collected_content}\n\n{final_content}",
                        tool_calls=[tc for tc in tool_calls.values()]
                    ))
                    db.commit()

            yield "data: [DONE]\n\n"
        finally:
            db.close()

    return StreamingResponse(generate(), media_type="text/event-stream")

# Architecture

## System Design

```
┌─────────────┐     ┌─────────────────────────────────────────────┐
│  Frontend    │     │  Backend (FastAPI)                          │
│  (Next.js)   │◄───►│                                              │
│  :3000       │     │  Routers → Services → Database             │
└─────────────┘     │                                              │
                    │  ┌─────────────────┐  ┌──────────────────┐  │
                    │  │ Nethermind AI Agent │  │ Workflow Engine  │  │
                    │  │ (OpenAI + Tools)│  │ (IRIS-style)     │  │
                    │  └────────┬────────┘  └────────┬─────────┘  │
                    │           │                     │            │
                    │  ┌────────▼────────┐  ┌────────▼─────────┐  │
                    │  │ Netmiko Client  │  │ Security Auditor │  │
                    │  │ (SSH to devices)│  │ (CVE/ACL/AAA)    │  │
                    │  └─────────────────┘  └──────────────────┘  │
                    │  ┌──────────────────────────────────────┐   │
                    │  │ Containerlab Service                 │   │
                    │  │ (.clab.yml parser + sync)            │   │
                    │  └──────────────────────────────────────┘   │
                    └──────────────────────────────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │    Database (SQLite/PG)  │
                         │  Switches, Configs,      │
                         │  Workflows, Findings,    │
                         │  Metrics, Audit Logs     │
                         └─────────────────────────┘
```

## Data Flow

### Config Backup
1. User triggers sync via UI or API
2. Netmiko client SSHes into device
3. Fetches running-config (vendor-specific commands)
4. Hashes config (SHA-256) for change detection
5. Stores backup in DB
6. Captures health metrics (CPU, memory)
7. Updates device status
8. Writes audit log entry

### AI Chat
1. User sends message via SSE endpoint
2. System loads chat history from DB
3. OpenAI API called with tools definitions
4. If tools requested → execute locally, return results
5. Final response streamed back via SSE
6. Messages persisted to DB

### Workflow Engine
1. Create workflow with target switches
2. Engine initializes Discover step
3. Each step is executed sequentially
4. State-changing steps require human approval
5. Results tracked per step
6. Audit trail maintained throughout
7. On completion, workflow marked as completed

## Database Schema

See `models/__init__.py` for full schema. Key tables:
- `switches` — Network device inventory
- `config_backups` — Running/startup config snapshots
- `config_diffs` — Computed diffs between backups
- `chat_messages` — AI chat history
- `workflows` — Change management workflows
- `workflow_steps` — Individual workflow steps
- `audit_logs` — Immutable action log
- `security_findings` — CVE, ACL, AAA findings
- `containerlab_topologies` — Parsed topology data
- `device_metrics` — Time-series health data

## Frontend Architecture

- **Next.js 14** with App Router
- **Tailwind CSS** for styling (dark theme)
- **lucide-react** for icons
- **Server-Sent Events** for streaming AI chat
- Direct API calls to backend (no GraphQL)
- TypeScript throughout

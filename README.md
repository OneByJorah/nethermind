# Nethermind ⚡ — DEPRECATED

> ⚠️ **This repository is deprecated.** All features (serial console, Jinja2 template engine, 45+ templates) have been **merged into [hermes-switch-manager](https://github.com/OneByJorah/hermes-switch-manager)**. See [DEPRECATED.md](DEPRECATED.md) for details. No new development will occur here.

**AI-powered network switch management platform** — a comprehensive, open-source platform that combines multi-vendor SSH and **serial console** management, a **Jinja2 config template engine** with 45+ built-in templates, an AI chat assistant, workflow automation, security auditing, Containerlab topology integration, and real-time device monitoring.

> Inspired by [IRIS](https://github.com/kiskander/iris), [NetClaw](https://github.com/automateyournetwork/netclaw), and [AINetworkHelperForContainerLab](https://github.com/zerxen/AINetworkHelperForContainerLab).

---

## Features ✨

| Feature | Description |
|---------|-------------|
| **🔌 Multi-Vendor SSH + Serial** | Cisco IOS/XE/X, **HP Aruba (OS-Switch)**, Juniper JunOS, Arista EOS, Linux — via Netmiko **and** serial console (COM) |
| **📋 Config Templates** | **45+ built-in Jinja2 templates** — factory reset, VLANs, STP, OSPF, security, PoE, and more. Create your own with variable substitution |
| **🤖 Hermes AI Agent** | OpenAI-powered chat assistant with tool calling (pull configs, check health, run audits, apply templates) |
| **🔧 Serial Console Support** | Connect via COM/serial for initial provisioning, out-of-band management, and recovery — full baud/parity/stop-bit control |
| **📋 Config Management** | Backup, version history, unified diff, change detection |
| **🔄 Workflow Engine** | IRIS-style disciplined workflow: Discover → Verify → Propose → Confirm → Execute → Verify → Document |
| **🔒 Security Auditing** | CVE scanning, ACL review, AAA checks, password policy, compliance (CIS/NIST) |
| **🗺️ Containerlab Integration** | Auto-discover topologies, parse .clab.yml, sync devices |
| **📊 Health Monitoring** | Real-time CPU, memory, interface metrics with time-series data |
| **📜 Audit Trail** | Immutable audit logs for all state-changing actions |
| **🌐 Web Dashboard** | Next.js frontend with dark theme, tables, charts, and streaming AI chat |

---

## Quick Start 🚀

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional)

### Docker Compose (recommended)

```bash
git clone https://github.com/OneByJorah/nethermind.git
cd nethermind
docker-compose up -d --build
```

Backend → http://localhost:8000 (API docs at /docs)  
Frontend → http://localhost:3000

### Local Development

```bash
# 1. Clone and enter
git clone https://github.com/OneByJorah/nethermind.git
cd nethermind

# 2. Backend setup
cd backend
cp .env.example .env
# Edit .env: add OPENAI_API_KEY, SSH credentials
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

---

## Architecture 🏗️

```
nethermind/
├── backend/                  # FastAPI Python backend
│   ├── main.py              # App entry point + lifespan
│   ├── config.py            # Pydantic settings
│   ├── database.py          # SQLAlchemy engine + session
│   ├── models/              # Database models
│   │   └── __init__.py      # Switch, ConfigBackup, ConfigTemplate, ChatMessage, Workflow, etc.
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── services/            # Business logic
│   │   ├── netmiko_client.py       # Multi-vendor SSH client
│   │   ├── serial_client.py        # Serial console client (COM port)
│   │   ├── template_engine.py      # Jinja2 config template engine (45+ built-in templates)
│   │   ├── hermes_agent.py         # AI agent with tool calling
│   │   ├── workflow_engine.py      # IRIS workflow engine
│   │   ├── containerlab_service.py # Topology parser
│   │   └── security_auditor.py     # CVE, ACL, AAA audits
│   ├── routers/             # FastAPI routers
│   │   ├── switches.py      # CRUD + sync + health (SSH + serial)
│   │   ├── templates.py     # Config template CRUD + render + apply
│   │   ├── configs.py       # Config backup + diff
│   │   ├── chat.py          # SSE streaming chat
│   │   ├── workflows.py     # Workflow lifecycle
│   │   ├── dashboard.py     # Stats + metrics
│   │   ├── security.py      # Findings + audit
│   │   └── containerlab.py  # Topology endpoints
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # Next.js 14 frontend
│   ├── src/
│   │   ├── app/             # Pages (dashboard, switches, configs, templates, chat, etc.)
│   │   ├── components/      # Reusable components
│   │   └── lib/             # API client + utils
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml        # Full stack deployment
├── scripts/                  # Utility scripts
└── docs/                     # Documentation
```

---

## Config Templates 📋

Nethermind ships with **45 built-in templates** that auto-seed on first startup. Templates use Jinja2 syntax with variable substitution.

### HP ArubaOS-Switch (40 templates)

| Category | Templates |
|----------|-----------|
| **Initial Setup** | Hostname + Mgmt IP, Factory Reset & Erase, Save Config |
| **Management** | SSH & Management Access, Banner, LLDP, Stacking |
| **Security** | AAA/RADIUS, TACACS+, Port Security (MAC), 802.1X, DHCP Snooping, DAI, Storm Control |
| **VLAN** | VLAN Creation (multi), Access Port, Trunk Port, Voice VLAN, MAC VLAN |
| **Interfaces** | LACP Trunk (static + dynamic), Interface Range Config, PoE |
| **Routing** | Static Route, OSPF, VLAN Interface (SVI), VRRP |
| **ACLs** | Standard IPv4 ACL, Extended IPv4 ACL |
| **Monitoring** | sFlow, Mirror Port (SPAN), Syslog/Logging |
| **STP** | RSTP/MSTP Configuration |
| **Maintenance** | Firmware Upgrade, Config Backup/Restore (TFTP), Disable/Enable All Ports |

### Cisco IOS (5 templates)

| Category | Templates |
|----------|-----------|
| **VLAN** | VLAN Configuration |
| **Interfaces** | Access Port, Trunk Port |
| **Security** | SSH & Management Access |
| **Maintenance** | Factory Reset |

### Creating Your Own

Templates support Jinja2 variables like `{{ vlan_id }}` and `{{ vlan_name }}`. Define variable schemas (type, description, required) for the UI to auto-generate input forms.

---

## Serial Console Support 🔧

Connect to switches via serial console cable for:
- **Initial provisioning** — before IP/SSH is configured
- **Out-of-band management** — when the network is down
- **Recovery scenarios** — password recovery, boot issues
- **Lab environments** — direct console access

Configure per-switch: port (`/dev/ttyUSB0`, `COM3`), baud rate (9600–115200), data bits, parity, stop bits, and enable password.

---

## API Endpoints 🔌

### Switches
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/switches/` | List switches |
| POST | `/api/switches/` | Add switch (SSH or serial) |
| GET | `/api/switches/{id}` | Get switch |
| PUT | `/api/switches/{id}` | Update switch |
| DELETE | `/api/switches/{id}` | Delete switch |
| POST | `/api/switches/{id}/sync` | Pull config via SSH or serial |
| POST | `/api/switches/{id}/health` | Health check |
| POST | `/api/switches/{id}/commands` | Execute show commands |
| POST | `/api/switches/{id}/push-config` | Push config commands |
| POST | `/api/switches/{id}/apply-template` | Render & preview template |
| GET | `/api/switches/serial/ports` | List available COM ports |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/templates/` | List templates |
| POST | `/api/templates/` | Create template |
| GET | `/api/templates/{id}` | Get template |
| PUT | `/api/templates/{id}` | Update template |
| DELETE | `/api/templates/{id}` | Delete template |
| POST | `/api/templates/render` | Preview rendered config |
| POST | `/api/templates/apply/{switch_id}` | Apply template to switch |
| POST | `/api/templates/seed` | Seed built-in templates |

### Configs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/configs/` | List backups |
| GET | `/api/configs/{id}` | Get backup |
| GET | `/api/configs/{switch_id}/latest` | Latest config |
| POST | `/api/configs/diff` | Diff two backups |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/stream` | SSE streaming chat |
| GET | `/api/chat/history/{session_id}` | Chat history |

### Workflows
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/workflows/` | Create workflow |
| GET | `/api/workflows/` | List workflows |
| POST | `/api/workflows/{id}/advance` | Advance step |
| POST | `/api/workflows/{id}/steps/{step_id}/execute` | Execute step |

### Security
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/security/findings` | List findings |
| POST | `/api/security/audit/{id}` | Audit device |
| POST | `/api/security/audit-all` | Audit all devices |
| PUT | `/api/security/findings/{id}` | Resolve finding |

### Containerlab
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/containerlab/topologies` | List topologies |
| POST | `/api/containerlab/scan` | Scan for topologies |

---

## Hermes AI Agent 🤖

Hermes is an OpenAI-powered network assistant with access to the following tools:

| Tool | Description |
|------|-------------|
| `get_switch_list` | List all managed switches |
| `get_switch_config` | Get latest running config |
| `run_switch_command` | Execute show commands via SSH or serial |
| `pull_live_config` | Pull fresh config from device |
| `get_switch_health` | Real-time health metrics |
| `get_security_findings` | Security audit results |
| `diff_configs` | Compare two configs |
| `get_audit_logs` | Recent activity |
| `get_network_dashboard` | Full network summary |

---

## IRIS Workflow Engine 🔄

The workflow engine follows a disciplined operational cycle:

```
Discover → Verify → Propose → Confirm → Execute → Verify → Document
```

Each step:
- Tracks status (`pending`, `running`, `completed`, `failed`, `rejected`)
- Requires human approval for state-changing steps (`confirm`, `execute`)
- Logs results in an immutable audit trail
- Supports ticket reference integration

---

## Security Auditing 🔒

The security auditor performs these checks:

| Check | What it does | Severity |
|-------|-------------|----------|
| **CVE Scan** | Checks OS version against known vulnerabilities | Critical |
| **AAA Audit** | Validates authentication, authorization, accounting | High |
| **Insecure Protocols** | Detects Telnet, HTTP, SNMPv1/v2c, TFTP | High |
| **Password Policy** | Checks encryption, minimum length | Medium |
| **ACL Review** | Flags missing deny-all, excessive entries | Low |
| **Compliance** | Logging, NTP, DNS, SSH version checks | Medium |

---

## Environment Variables 🌐

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./switches.db` | Database connection string |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | AI model to use |
| `SSH_USERNAME` | `admin` | Default SSH username |
| `SSH_PASSWORD` | — | Default SSH password |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `CLAB_DIR` | `/etc/containerlab/lab` | Containerlab directory |
| `LOG_LEVEL` | `INFO` | Logging level |

---

## Deployment 🚢

### Docker Compose (recommended)
```bash
docker-compose up -d --build
```

### Railway
```bash
# Backend config is included in backend/railway.json
# Set DATABASE_URL to PostgreSQL, add OPENAI_API_KEY
```

---

## Contributing 🤝

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

---

## License 📄

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments 🙏

- [IRIS](https://github.com/kiskander/iris) — Workflow engine inspiration
- [NetClaw](https://github.com/automateyournetwork/netclaw) — AI agent + security concepts
- [AINetworkHelperForContainerLab](https://github.com/zerxen/AINetworkHelperForContainerLab) — Containerlab integration
- [Netmiko](https://github.com/ktbyers/netmiko) — Multi-vendor SSH library
- [OpenAI](https://openai.com) — AI chat capabilities

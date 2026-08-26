# Nethermind

**AI-powered network switch configuration management** — multi-vendor SSH + serial, Jinja2 templates, AI agent, and security auditing.

![License](https://img.shields.io/badge/license-MIT-brightgreen)
![Language](https://img.shields.io/badge/language-Python-blue)

---

## What it does

Nethermind is a full-stack web application for managing network switches and routers. It combines:

- **Multi-Vendor Support** — Cisco IOS/XR/NX-OS, HP ArubaOS-Switch (ProCurve), Juniper JunOS, Arista EOS, and Linux
- **SSH & Serial Console** — connect via Netmiko (SSH) or serial/USB console (pyserial)
- **50+ Jinja2 Templates** — built-in configuration templates for Aruba, Cisco, and generic network devices
- **AI Chat Assistant** — OpenAI-powered chat with tool calling for natural-language network management
- **IRIS-Style Workflow Engine** — disciplined config change management with approval gates
- **Security Auditing** — CVE scanning, AAA checks, CIS/NIST compliance auditing
- **Config Diff & Rollback** — compare config versions and restore previous configs
- **Containerlab Integration** — manage containerlab lab topologies
- **Device Health Monitoring** — CPU, memory, interface status metrics
- **Immutable Audit Trail** — every action logged with actor, target, and timestamp

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│          Next.js + TypeScript + Tailwind         │
│   Dashboard │ Switches │ Configs │ Templates     │
│   Chat │ Workflows │ Security │ Topology         │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│                    Backend                       │
│              FastAPI + SQLAlchemy                 │
│                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ Netmiko SSH │  │ Serial/COM   │  │ AI     │ │
│  │ Client      │  │ Client       │  │ Agent  │ │
│  └─────────────┘  └──────────────┘  └────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ Template    │  │ Config       │  │Workflow│ │
│  │ Engine      │  │ Parser       │  │ Engine │ │
│  └─────────────┘  └──────────────┘  └────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ Deployer    │  │ Security     │  │Audit   │ │
│  │             │  │ Auditor      │  │Trail   │ │
│  └─────────────┘  └──────────────┘  └────────┘ │
└──────────────────────┬──────────────────────────┘
                       │
              ┌────────▼────────┐
              │   SQLite / PG   │
              │   Database      │
              └─────────────────┘
```

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/OneByJorah/nethermind.git
cd nethermind
cp .env.example .env
# Edit .env with your settings (at minimum: OPENAI_API_KEY)
docker compose up -d
```

Open **http://localhost:3000** for the web UI, or **http://localhost:8000/docs** for the API docs.

### Local Development

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## CLI

Nethermind also includes a CLI for quick config operations:

```bash
cd scripts
python cli.py render --hostname MY-SW --mgmt-ip 192.168.1.10
python cli.py parse /path/to/running-config.txt
python cli.py deploy --transport telnet --host 192.168.1.1 --port 9023
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/switches/` | List all switches |
| `POST` | `/api/switches/` | Add a new switch |
| `POST` | `/api/switches/{id}/backup` | Pull running config via SSH |
| `GET` | `/api/configs/{id}` | Get config backup |
| `POST` | `/api/config/parse` | Upload .txt config → structured JSON |
| `POST` | `/api/config/validate` | Validate a config before deploy |
| `POST` | `/api/config/render` | Render config to CLI text |
| `POST` | `/api/config/deploy` | Deploy config to a switch |
| `GET` | `/api/templates/` | List config templates |
| `POST` | `/api/templates/render` | Render a template with variables |
| `POST` | `/api/chat/` | Chat with AI assistant |
| `GET` | `/api/workflows/` | List workflows |
| `GET` | `/api/security/` | Security findings |
| `GET` | `/api/system/serial-ports` | List serial ports |
| `GET` | `/health` | Health check |

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./switches.db` | Database connection string |
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key for AI agent |
| `OPENAI_MODEL` | `gpt-4o` | Model used by the AI agent |
| `SSH_USERNAME` | `admin` | Default SSH username for switches |
| `SSH_PASSWORD` | *(empty)* | Default SSH password |
| `SECRET_KEY` | `change-me` | Application secret key |

## Security

- **Never commit `.env` files** — they contain credentials
- **SSH passwords are encrypted at rest** in the database
- **Audit trail is immutable** — all actions are logged
- **Config diffs are tracked** — every change is versioned

## License

MIT License — see [LICENSE](LICENSE) for details.

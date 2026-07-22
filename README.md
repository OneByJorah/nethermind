# nethermind

AI-powered network switch management platform — multi-vendor SSH + serial console, 45+ Jinja2 config templates, AI agent, workflow automation, and security auditing.

![status](https://img.shields.io/badge/status-active-FFB300?style=flat-square)
![language](https://img.shields.io/badge/python+typescript-0d0d0c?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-FFB300?style=flat-square)

## Overview

Nethermind is a comprehensive, self-hosted network switch management platform that combines multi-vendor SSH and serial console management with 45+ built-in Jinja2 config templates, an OpenAI-powered AI chat assistant, workflow automation, security auditing, Containerlab topology integration, and real-time device monitoring. It extends hermes-switch-manager with serial console support and a template engine for bulk configuration.

Inspired by IRIS, NetClaw, and AINetworkHelperForContainerLab.

## Features

- Multi-vendor SSH + serial — Cisco IOS/XE/X, HP Aruba, Juniper JunOS, Arista EOS, Linux (Netmiko + COM serial)
- 45+ Jinja2 config templates — factory reset, VLANs, STP, OSPF, security, PoE, and more
- Hermes AI agent — OpenAI-powered chat with tool calling (pull configs, check health, run audits, apply templates)
- Serial console support — COM/serial for initial provisioning, out-of-band management, and recovery
- Config management — backup, version history, unified diff, change detection
- Workflow engine — Discover > Verify > Propose > Confirm > Execute > Verify > Document
- Security auditing — CVE scanning, ACL review, AAA checks, password policy, CIS/NIST compliance
- Containerlab integration — auto-discover topologies, parse .clab.yml, sync devices
- Health monitoring — real-time CPU, memory, interface metrics with time-series data
- Immutable audit trail for all state-changing actions
- Next.js web dashboard with dark theme, tables, charts, and streaming AI chat

## Architecture / Tech Stack

- **Backend**: FastAPI (Python), Netmiko, OpenAI API
- **Frontend**: Next.js (TypeScript)
- **Templates**: Jinja2 (45+ built-in)
- **Network**: SSH (Netmiko), Serial (COM), SNMP
- **Lab**: Containerlab topology integration
- **Deployment**: Docker Compose, local dev

## Installation

```bash
git clone https://github.com/OneByJorah/nethermind.git
cd nethermind

# Backend
cd backend
cp .env.example .env  # Add OPENAI_API_KEY, SSH credentials
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Or with Docker:
```bash
docker compose up -d
```

## Configuration

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for Hermes AI agent |
| `SSH_USERNAME` | Default SSH username for switches |
| `SSH_PASSWORD` | Default SSH password |

See `backend/.env.example` for full options.

## License

MIT — see [LICENSE](LICENSE).

---
Part of the JorahOne / J1 ecosystem — AI-powered network management for multi-vendor environments.

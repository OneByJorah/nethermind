<div align="center">

![nethermind banner](docs/assets/banner.svg)

# nethermind

AI-powered network switch management

![License](https://img.shields.io/badge/license-MIT-brightgreen)
![Language](https://img.shields.io/badge/language-Python-blue)
</div>

---

<p align="center">
  <img src="docs/assets/screenshot.png" alt="nethermind preview" width="90%">
</p>

<br>

---

## Features

- **Multi-Vendor Support** — Manage Cisco, HP Aruba, Juniper, Arista, and Linux devices.
- **SSH & Serial** — Connect via Netmiko (SSH) and serial console (COM) connections.
- **45+ Jinja2 Templates** — Built-in configuration templates for common network tasks.
- **IRIS-Style Workflow Engine** — Disciplined configuration change management.
- **Hermes AI Agent** — OpenAI-powered chat assistant for network operations.
- **Security Auditing** — CVE scanning, AAA checks, CIS/NIST compliance auditing.
- **Containerlab Integration** — Auto-discovery and synchronization of lab topologies.
- **Next.js Dashboard** — Modern, responsive web interface.

## Quick Start

```bash
git clone https://github.com/OneByJorah/nethermind.git
cd nethermind

cp .env.example .env  # Configure OpenAI key and database
docker compose up -d
```

Open **http://localhost:3000** in your browser.

### Local Development

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///nethermind.db` | Database connection string |
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key for Hermes AI |
| `DEFAULT_SSH_USERNAME` | `admin` | Default SSH username for devices |
| `DEFAULT_SSH_PASSWORD` | — | Default SSH password (use env in production) |
| `SERIAL_BAUD_RATE` | `9600` | Default serial baud rate |

## Architecture

```
Browser (Next.js) ──API──▶ FastAPI Backend ──▶ SQLAlchemy ──▶ SQLite
                                │
                                ├──▶ Netmiko (SSH) ──▶ Network Switches
                                ├──▶ Serial Client ──▶ Console Ports
                                ├──▶ Hermes AI (OpenAI)
                                ├──▶ Jinja2 Templates
                                ├──▶ Workflow Engine
                                └──▶ Security Auditor
```

## Tech Stack

- **Backend**: FastAPI (Python 3.11+), SQLAlchemy, Netmiko
- **Frontend**: Next.js 14 (TypeScript)
- **AI**: OpenAI GPT (Hermes agent)
- **Templates**: Jinja2 (45+ built-in)
- **Database**: SQLite (default), PostgreSQL (production)
- **Deployment**: Docker Compose, Railway

## Supported Vendors

| Vendor | Platforms |
|--------|-----------|
| **Cisco** | IOS, IOS-XE, NX-OS, ASA |
| **HP Aruba** | ArubaOS, Comware |
| **Juniper** | JunOS |
| **Arista** | EOS |
| **Linux** | Ubuntu, CentOS, Debian |

## Project Structure

```
nethermind/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── services/
│   │   ├── netmiko_client.py    # SSH connection management
│   │   ├── serial_client.py     # Serial console connections
│   │   ├── jinja_engine.py      # Template rendering
│   │   ├── hermes_agent.py      # AI chat assistant
│   │   ├── workflow_engine.py   # IRIS-style workflows
│   │   ├── containerlab.py      # Containerlab integration
│   │   └── security_auditor.py  # CVE/compliance scanning
│   ├── routers/              # API endpoint modules
│   └── models/               # Database models
├── frontend/
│   ├── src/app/              # Next.js pages
│   └── package.json
├── templates/                # Jinja2 config templates
├── docker-compose.yml        # Docker deployment
└── .env.example              # Configuration template
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/switches` | GET/POST | Manage network switches |
| `/api/switches/{id}/connect` | POST | Connect to a switch |
| `/api/configs/{id}` | GET | Retrieve device configuration |
| `/api/templates` | GET | List Jinja2 templates |
| `/api/chat` | POST | Chat with Hermes AI agent |
| `/api/workflows` | GET/POST | Manage configuration workflows |
| `/api/security/audit` | POST | Run security audit on device |

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## Security

For security concerns, see [SECURITY.md](SECURITY.md). Please report vulnerabilities to **info@jorahone.com** — do not use public issues.

## License

MIT © Jhonattan L. Jimenez

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## 🔒 Security

Found a vulnerability? Please follow our [Security Policy](SECURITY.md) and report privately to `security@jorahone.com`.

## 📄 License

[MIT License](LICENSE) © Jhonattan L. Jimenez (OneByJorah)

---

<p align="center">Built with 🌴 by <a href="https://github.com/OneByJorah">OneByJorah</a> · <a href="https://jorahone.com">jorahone.com</a></p>

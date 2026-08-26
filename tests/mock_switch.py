"""A tiny *fake* ArubaOS-Switch telnet/serial server.

It speaks just enough of the ProCurve CLI to let the Deployer run end-to-end
without real hardware: it echoes a prompt, accepts 'conf t', absorbs the
pushed config, honours 'write mem' and answers a hostname verification query.
Run it as a TCP server (port 9023) for testing the Telnet transport, or drive
it directly to test the deployer dialogue.

Usage:
    python -m tests.mock_switch            # opens TCP 127.0.0.1:9023
"""
from __future__ import annotations

import socket
import sys
import threading
import time


PROMPT_OPER = "switch> "
PROMPT_PRIV = "switch# "
PROMPT_CFG = "switch(config)# "


def _session(sock: socket.socket):
    buf = b""
    state = "oper"
    hostname = "switch"
    saved_hostname = ""
    cfg_depth = 0  # nesting depth inside config mode (vlan blocks count)

    def prompt():
        if state == "cfg":
            return f"{hostname}(config)# "
        return f"{hostname}# " if state == "priv" else f"{hostname}> "

    def _safe_send(data: bytes):
        try:
            sock.sendall(data)
        except Exception:
            pass

    _safe_send(PROMPT_OPER.encode())
    while True:
        try:
            data = sock.recv(4096)
        except Exception:
            break
        if not data:
            break
        text = data.decode("utf-8", errors="replace")
        # telnet clients send CR LF; split on newline
        for line in text.split("\n"):
            line = line.strip("\r")
            if not line:
                continue
            cmd = line.strip()
            low = cmd.lower()
            if low == "enable":
                state = "priv"
            elif low == "conf t" or low == "configure terminal":
                state = "cfg"
                cfg_depth = 1
            elif low.startswith("hostname"):
                m = cmd.split('"')
                if len(m) >= 2:
                    saved_hostname = m[1]
                hostname = saved_hostname or hostname
            elif low == "write mem" or low.startswith("write memory"):
                _safe_send(f"Configuration edited by operator saved\r\n".encode())
            elif low.startswith("show running-config"):
                _safe_send(f'hostname "{saved_hostname}"\r\n'.encode())
            elif low == "exit":
                if state == "cfg":
                    cfg_depth -= 1
                    if cfg_depth <= 0:
                        state = "priv"
                        cfg_depth = 0
                elif state == "priv":
                    state = "oper"
            elif state == "cfg" and low.startswith("vlan "):
                cfg_depth += 1
            # everything else (ip, snmp, etc.) is silently accepted
        _safe_send(prompt().encode())
    sock.close()


def serve(host: str = "127.0.0.1", port: int = 9023):
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((host, port))
    srv.listen(5)
    print(f"[mock-switch] listening on {host}:{port} (fake ArubaOS-Switch)")
    try:
        while True:
            conn, addr = srv.accept()
            t = threading.Thread(target=_session, args=(conn,), daemon=True)
            t.start()
    except KeyboardInterrupt:
        print("\n[mock-switch] stopped")


if __name__ == "__main__":
    serve(*(sys.argv[1:3] if len(sys.argv) > 2 else ("127.0.0.1", 9023)))

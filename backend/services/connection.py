"""Connection layer for switches.

Supports three transports:
  * serial  - console / USB-serial cable (pyserial)
  * ssh     - TCP/IP management via SSH (paramiko)  -> ArubaOS-Switch
  * telnet  - TCP/IP management via Telnet (socket)  -> older ProCurve

All transports present the same Connection interface: connect(), send_line(),
read_until(prompt, timeout), close().  The deployer drives them.
"""
from __future__ import annotations

import logging
import socket
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger("nethermind.connection")


# Prompts a ProCurve/Aruba switch shows (we match the trailing '#' or '>').
CONFIG_PROMPT = r"[>\#] *$"
OPER_PROMPT = r"> *$"
PRIV_PROMPT = r"\# *$"

# --------------------------------------------------------------------------
# Serial (console / USB)
# --------------------------------------------------------------------------
class SerialConnection(ABC):
    pass


@dataclass
class SerialParams:
    port: str = "COM3"
    baud: int = 9600
    bytesize: int = 8
    parity: str = "N"
    stopbits: int = 1
    timeout: float = 0.5


# --------------------------------------------------------------------------
# Parameter objects
# --------------------------------------------------------------------------
@dataclass
class ConnParams:
    transport: str                 # "serial" | "ssh" | "telnet"
    host: str = ""                 # for ssh/telnet
    port: int = 22                 # ssh default; telnet=23
    username: str = ""
    password: str = ""
    serial_port: str = "COM3"
    baud: int = 9600
    timeout: float = 12.0


class Connection(ABC):
    """Common interface used by the deployer."""

    def __init__(self, params: ConnParams):
        self.params = params
        self._buf = ""

    @abstractmethod
    def connect(self) -> None: ...

    @abstractmethod
    def close(self) -> None: ...

    @abstractmethod
    def _write(self, data: str) -> None: ...

    def send_line(self, line: str, delay: float = 0.15) -> None:
        if line:
            self._write(line + "\r\n")
        else:
            self._write("\r\n")
        time.sleep(delay)

    def read_until(self, pattern: str, timeout: Optional[float] = None,
                   chunk_timeout: float = 0.4) -> str:
        """Read until a regex pattern (re.search) is found or timeout.

        Searches the tail of ``_buf`` (last 512 chars) so recently-buffered
        data is still visible while stale matches from much older commands
        are ignored.
        """
        import re
        rx = re.compile(pattern)
        deadline = time.time() + (timeout if timeout is not None else self.params.timeout)
        data = ""
        while time.time() < deadline:
            try:
                chunk = self._read_chunk(chunk_timeout)
            except socket.timeout:
                chunk = ""
            except Exception:  # pragma: no cover - defensive
                chunk = ""
            if chunk:
                self._buf += chunk
                data += chunk
                tail = self._buf[-512:]
                if rx.search(tail):
                    return data
        return data

    def _read_chunk(self, chunk_timeout: float) -> str:  # overridden
        raise NotImplementedError

    def wait_for_oper(self) -> str:
        return self.read_until(OPER_PROMPT)

    def wait_for_priv(self) -> str:
        return self.read_until(PRIV_PROMPT)

    @staticmethod
    def build(params: ConnParams) -> "Connection":
        if params.transport == "serial":
            return PySerialConnection(params)
        if params.transport == "ssh":
            return SshConnection(params)
        if params.transport == "telnet":
            return TelnetConnection(params)
        raise ValueError(f"unknown transport: {params.transport}")


# --------------------------------------------------------------------------
# PySerial console
# --------------------------------------------------------------------------
class PySerialConnection(Connection):
    def __init__(self, params: ConnParams):
        super().__init__(params)
        import serial  # local import so module loads without hardware
        self._ser = serial.Serial(
            port=params.serial_port,
            baudrate=params.baud,
            bytesize=params.baud and 8,
            parity="N",
            stopbits=1,
            timeout=0.4,
        )

    def connect(self) -> None:
        if not self._ser.is_open:
            self._ser.open()
        # Switches often need a blank line + tiny pause to show prompt.
        self._write("\r\n")
        time.sleep(1.0)
        self.read_until(PRIV_PROMPT + "|" + OPER_PROMPT, timeout=4.0)

    def close(self) -> None:
        try:
            self._ser.close()
        except Exception:
            pass

    def _write(self, data: str) -> None:
        self._ser.write(data.encode("utf-8", errors="replace"))

    def _read_chunk(self, chunk_timeout: float) -> str:
        self._ser.timeout = chunk_timeout
        raw = self._ser.read(4096)
        return raw.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------
# SSH (paramiko)
# --------------------------------------------------------------------------
class SshConnection(Connection):
    def __init__(self, params: ConnParams):
        super().__init__(params)
        import paramiko
        self._ssh = paramiko.SSHClient()
        self._ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self._chan = None

    def connect(self) -> None:
        self._ssh.connect(
            hostname=self.params.host,
            port=self.params.port,
            username=self.params.username,
            password=self.params.password,
            look_for_keys=False,
            allow_agent=False,
            timeout=self.params.timeout,
        )
        self._chan = self._ssh.invoke_shell()
        self._chan.settimeout(0.4)
        time.sleep(1.0)
        self.read_until(PRIV_PROMPT + "|" + OPER_PROMPT, timeout=6.0)

    def close(self) -> None:
        try:
            self._chan.close()
        except Exception:
            pass
        try:
            self._ssh.close()
        except Exception:
            pass

    def _write(self, data: str) -> None:
        self._chan.send(data)

    def _read_chunk(self, chunk_timeout: float) -> str:
        try:
            self._chan.settimeout(chunk_timeout)
            raw = self._chan.recv(4096)
            return raw.decode("utf-8", errors="replace")
        except socket.timeout:
            return ""
        except EOFError:
            return ""


# --------------------------------------------------------------------------
# Telnet (raw socket)
# --------------------------------------------------------------------------
class TelnetConnection(Connection):
    def __init__(self, params: ConnParams):
        super().__init__(params)
        self._sock: Optional[socket.socket] = None

    def connect(self) -> None:
        self._sock = socket.create_connection(
            (self.params.host, self.params.port), timeout=self.params.timeout)
        time.sleep(0.5)
        # Some ProCurve prompt for username/password even on telnet.
        data = self.read_until(r"[Ll]ogin:|[Pp]assword:|" + PRIV_PROMPT, timeout=6.0)
        if "ogin" in data or "LOGIN" in data:
            self.send_line(self.params.username, delay=0.5)
            self.read_until(r"[Pp]assword:")
            self.send_line(self.params.password, delay=0.5)
        self.read_until(PRIV_PROMPT + "|" + OPER_PROMPT, timeout=6.0)

    def close(self) -> None:
        try:
            self._sock.close()
        except Exception:
            pass

    def _write(self, data: str) -> None:
        self._sock.sendall(data.encode("utf-8", errors="replace"))

    def _read_chunk(self, chunk_timeout: float) -> str:
        self._sock.settimeout(chunk_timeout)
        try:
            raw = self._sock.recv(4096)
            return raw.decode("utf-8", errors="replace")
        except socket.timeout:
            return ""
        except EOFError:
            return ""

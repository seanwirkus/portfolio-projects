#!/usr/bin/env python3
"""
PC viewer for esp32cam-serial JPEG-over-USB framing (magic CA FE 4A 50 + length + JPEG).

Requires: pip install pyserial pillow

Example (Tk window — needs working Tcl/Tk on your Python):
  python3 tools/view_serial.py --port /dev/cu.usbserial-0001 --send-init

If Tk exits instantly on macOS, use HTTP instead (Safari / Chrome → no Tk):
  python3 tools/view_serial.py --port /dev/cu.usbserial-0001 --send-init --http

(On macOS use **/dev/cu.*** — **/dev/tty.*** often errors with "Device not configured".)
"""

from __future__ import annotations

import argparse
import io
import os
import platform
import struct
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

MAGIC = bytes([0xCA, 0xFE, 0x4A, 0x50])

JPEG_MIN = 100
JPEG_MAX = 524288


def drain_serial(ser: object, total_s: float = 0.35) -> None:
    """Drop stale inbound bytes before we talk to the ESP."""
    try:
        import time as _t

        deadline = _t.monotonic() + total_s
        while _t.monotonic() < deadline:
            n = getattr(ser, "in_waiting", 0)
            if n:
                getattr(ser, "read")(min(n, 8192))
            else:
                _t.sleep(0.025)
    except OSError:
        pass


def resolve_port(path: str) -> str:
    """
    On macOS, use /dev/cu.* (callout) for opening the port as the host.
    /dev/tty.* often fails with OSError: [Errno 6] Device not configured.
    """
    if platform.system() != "Darwin":
        return path
    if path.startswith("/dev/tty.") and not path.startswith("/dev/tty.wlan"):
        cu = "/dev/cu." + path[len("/dev/tty.") :]
        if os.path.exists(cu):
            print(f"Using {cu} (macOS needs /dev/cu.*, not /dev/tty.*)", file=sys.stderr)
            return cu
    return path


def pick_default_port() -> Optional[str]:
    try:
        from serial.tools import list_ports
    except ImportError:
        return None
    ports = list(list_ports.comports())
    prefs = []
    for p in ports:
        dl = (p.device or "").lower()
        skip = ("bluetooth", "debug-console", "wlan-debug")
        if any(s in dl for s in skip):
            continue
        desc = (p.description or "")
        if "usbserial" in dl or ".usbmodem" in dl or "ttyusb" in dl:
            prefs.append(p)
        elif any(x in desc for x in ("UART", "CP210", "CH340", "Silicon Labs", "UsbSerial")):
            prefs.append(p)
    if len(prefs) == 1:
        return resolve_port(prefs[0].device)
    cand = [
        p
        for p in ports
        if not any(x in (p.device or "").lower() for x in ("bluetooth", "debug-console", "wlan-debug"))
    ]
    if len(cand) == 1:
        return resolve_port(cand[0].device)
    return None


def read_exact(ser, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        chunk = ser.read(n - len(buf))
        if not chunk:
            raise EOFError("serial closed")
        buf.extend(chunk)
    return bytes(buf)


def sync_and_read_frame(ser) -> bytes:
    """Scan byte stream until MAGIC, uint32 LE length, then JPEG."""
    buf = bytearray()
    while True:
        while True:
            b = ser.read(1)
            if not b:
                raise EOFError("serial closed")
            buf.append(b[0])
            if len(buf) > 8192:
                del buf[:4096]
            if len(buf) >= 4 and bytes(buf[-4:]) == MAGIC:
                break
        length_bytes = read_exact(ser, 4)
        (length,) = struct.unpack("<I", length_bytes)
        if length < JPEG_MIN or length > JPEG_MAX:
            buf.clear()
            continue
        jpeg = read_exact(ser, length)
        if jpeg.startswith(b"\xff\xd8") and len(jpeg) >= 4:
            return jpeg
        buf.clear()


def stdin_commands(ser, stop_evt: threading.Event) -> None:
    """Forward typed lines to the ESP32 (FLASH_ON, STREAM_OFF, …)."""
    print(
        "Type commands + Enter (STREAM_OFF, CAPTURE, …). Ctrl+D / Ctrl+C to exit.",
        flush=True,
    )
    try:
        for line in sys.stdin:
            if stop_evt.is_set():
                break
            ser.write(line.encode("utf-8", errors="ignore"))
            if not line.endswith("\n"):
                ser.write(b"\n")
    except EOFError:
        pass
    stop_evt.set()


class SerialJPEGSource:
    """Background reader: latest JPEG + sequence for MJPEG subscribers."""

    def __init__(self, ser) -> None:
        self.ser = ser
        self._cond = threading.Condition(threading.Lock())
        self.latest: bytes = b""
        self.frame_seq: int = -1  # incremented after each JPEG
        self.stop_evt = threading.Event()
        self.error: Optional[str] = None

    def read_loop(self) -> None:
        while not self.stop_evt.is_set():
            try:
                jpeg = sync_and_read_frame(self.ser)
            except EOFError:
                with self._cond:
                    self.error = self.error or "serial closed (disconnect?)"
                    self._cond.notify_all()
                break
            except Exception as e:  # noqa: BLE001
                with self._cond:
                    self.error = str(e)
                    self._cond.notify_all()
                break
            with self._cond:
                self.latest = jpeg
                self.frame_seq += 1
                self._cond.notify_all()

    def wait_until_after(self, last_seen: int) -> tuple[bytes, int]:
        import time as _time

        t_dead = _time.monotonic() + 120
        with self._cond:
            while self.frame_seq <= last_seen and not self.error:
                wait = max(0.05, min(5.0, t_dead - _time.monotonic()))
                self._cond.wait(timeout=wait)
                if _time.monotonic() > t_dead:
                    raise TimeoutError("no JPEG — check USB / baud / STREAM_ON on device")
            if self.error:
                raise RuntimeError(self.error)
            return self.latest, self.frame_seq


def run_http_server(ser, port: int, send_init: bool) -> int:
    stop_evt = threading.Event()
    src = SerialJPEGSource(ser)
    reader = threading.Thread(target=src.read_loop, daemon=True)
    reader.start()
    try:
        import time as _t

        _t.sleep(0.08)
    except KeyboardInterrupt:
        pass
    if send_init:
        ser.write(b"STREAM_ON\n")
        ser.flush()


    class Req(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args_) -> None:  # noqa: A003
            return

        def do_GET(self) -> None:
            raw = self.path.split("?", 1)[0]
            path = raw.rstrip("/") or "/"
            if path == "/" or path == "/index.html":
                body = """<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>ESP32-CAM serial</title></head>
<body style="margin:0;background:#111;color:#bbb;font-family:sans-serif">
<p style="margin:8px">Serial MJPEG (USB). Commands still work in terminal.</p>
<img src="/stream" style="max-width:100%;display:block;background:#000" alt="" />
</body></html>""".encode(
                    "utf-8",
                )
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return

            if path != "/stream":
                self.send_error(404, "Try /")
                return

            boundary = b"framemjpg"
            self.send_response(200)
            self.send_header(
                "Content-Type",
                "multipart/x-mixed-replace; boundary=" + boundary.decode("ascii"),
            )
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Pragma", "no-cache")
            self.end_headers()

            seen = -1
            try:
                while True:
                    try:
                        jpeg, sq = src.wait_until_after(seen)
                    except TimeoutError:
                        continue
                    except RuntimeError as e:
                        print(f"MJPEG: {e}", file=sys.stderr)
                        break
                    seen = sq

                    delim = (
                        b"--"
                        + boundary
                        + b"\r\nContent-Type: image/jpeg\r\n\r\n"
                    )
                    self.wfile.write(delim + jpeg + b"\r\n")
                    self.wfile.flush()
            except BrokenPipeError:
                pass
            except ConnectionResetError:
                pass

    httpd = ThreadingHTTPServer(("127.0.0.1", port), Req)
    stdin_t = threading.Thread(target=stdin_commands, args=(ser, stop_evt), daemon=True)
    stdin_t.start()

    print(
        f"Open http://127.0.0.1:{port}/ in a browser (Ctrl+C stops).\n",
        file=sys.stderr,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        stop_evt.set()
        src.stop_evt.set()
    finally:
        httpd.server_close()
        ser.close()

    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="ESP32-CAM USB-serial JPEG viewer")
    ap.add_argument("--port", "-p", help="Serial port (default: auto-pick plausible USB/UART)")
    ap.add_argument(
        "--list",
        action="store_true",
        help="List serial ports and exit",
    )
    ap.add_argument(
        "--http",
        nargs="?",
        const=8766,
        default=None,
        type=int,
        metavar="PORT",
        help="Serve MJPEG at http://127.0.0.1:PORT/ (browser; no Tk). Default port 8766.",
    )
    ap.add_argument("--baud", type=int, default=921600, help="Must match firmware (921600 for esp32cam-serial)")
    ap.add_argument("--send-init", action="store_true", help='Send "STREAM_ON\\n" after open')
    args = ap.parse_args()

    if args.list:
        try:
            from serial.tools import list_ports
        except ImportError:
            print("pip install pyserial", file=sys.stderr)
            return 1
        for p in list_ports.comports():
            hw = getattr(p, "hwid", None) or getattr(p, "hardware_id", "")
            print(p.device, p.description, hw, sep="\t")
        return 0

    try:
        import serial
    except ImportError:
        print("Install pyserial: pip install pyserial pillow", file=sys.stderr)
        return 1

    port = args.port or pick_default_port()
    if not port:
        print(
            'Specify --port (use: python3 tools/view_serial.py --list). On macOS prefer /dev/cu.usbserial-*',
            file=sys.stderr,
        )
        return 1

    port = resolve_port(port)

    try:
        ser = serial.Serial(port, args.baud, timeout=0.5)
    except OSError as e:
        print(f"Could not open {port}: {e}", file=sys.stderr)
        print(
            "Hints: (1) On macOS use /dev/cu.* not /dev/tty.*  (2) Quit Serial Monitor / other apps on the port  (3) Unplug/replug USB",
            file=sys.stderr,
        )
        return 1

    drain_serial(ser)

    if args.http is not None:
        return run_http_server(ser, args.http, args.send_init)

    try:
        from PIL import Image, ImageTk
        import tkinter as tk
    except ImportError:
        print(
            "Install pillow + Tk: pip install pillow\n"
            "Or run without Tk:\n"
            "  python3 tools/view_serial.py -p %(port)s --send-init --http"
            % {"port": port},
            file=sys.stderr,
        )
        ser.close()
        return 1

    stop_evt = threading.Event()
    if args.send_init:
        ser.write(b"STREAM_ON\n")
        ser.flush()

    root = tk.Tk()
    root.title("ESP32-CAM serial")

    label = tk.Label(root)
    label.pack()

    err_label = tk.Label(root, text="", fg="red")
    err_label.pack()

    def refresh_image() -> None:
        if stop_evt.is_set():
            root.after(100, root.quit)
            return
        try:
            jpeg = sync_and_read_frame(ser)
            img = Image.open(io.BytesIO(jpeg))
            photo = ImageTk.PhotoImage(img)
            label.configure(image=photo)
            label.image = photo
            err_label.configure(text="")
        except Exception as e:  # noqa: BLE001
            err_label.configure(text=str(e)[:120])
        root.after(1, refresh_image)

    root.after(0, refresh_image)

    t = threading.Thread(target=stdin_commands, args=(ser, stop_evt), daemon=True)
    t.start()

    try:
        root.mainloop()
    finally:
        stop_evt.set()
        ser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

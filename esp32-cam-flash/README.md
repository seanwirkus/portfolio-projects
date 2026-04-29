# ESP32-CAM — MJPEG + GPIO4 flash

Firmware for **AI-Thinker ESP32-CAM** (and pin-compatible clones): live video plus **flash on GPIO 4** (onboard LED and/or your carrier **IO4** terminal).

Two transports:

| Mode | Environment | How video reaches the PC |
|------|-------------|---------------------------|
| **Wi-Fi** | `esp32cam` | Browser → HTTP MJPEG (`/` and `/stream`) |
| **USB cable only (no Wi-Fi)** | `esp32cam-serial` | JPEG frames over **USB-serial** (see below) |

---

## Why “USB video” still uses serial on this board

The connector on ESP32-CAM is almost always a **USB‑UART bridge** (CH340 / CP210x / etc.). It is **not** a USB webcam (UVC). The PC sees a **COM/tty port**, not a camera device.

The **no‑Wi‑Fi** build streams **compressed JPEG** over that serial link at **921600 baud**. Throughput is limited—firmware uses smaller resolution/Q setting than the Wi-Fi build.

---

## Setup (Wi-Fi build)

1. Install [PlatformIO](https://platformio.org/).
2. `cp include/secrets.example.h include/secrets.h` and set SSID/password.
3. Upload:

   ```bash
   cd esp32-cam-flash
   pio run -e esp32cam -t upload
   pio device monitor -e esp32cam
   ```

4. Open `http://<printed-ip>/` in a browser.

### HTTP routes (Wi-Fi)

| Path | Method | Purpose |
|------|--------|---------|
| `/` | GET | Control page + `<img src="/stream">` |
| `/stream` | GET | MJPEG multipart stream |
| `/capture` | GET | Single JPEG (flash pulse during grab) |
| `/flash/on`, `/flash/off`, `/flash/pulse?ms=120` | POST | Flash control |

---

## Setup (USB serial — no Wi-Fi)

1. **Do not** need `secrets.h` for this environment (Wi-Fi code is not used).

2. Flash the serial firmware:

   ```bash
   pio run -e esp32cam-serial -t upload
   ```

3. **Close** the serial monitor before opening another app on the same port.

4. Optional: open a terminal at **921600** baud and send text commands (newline-terminated):

   - `STREAM_ON` — continuous JPEG frames (binary framing below)
   - `STREAM_OFF` or `STOP`
   - `CAPTURE` — one JPEG with flash assist
   - `FLASH_ON`, `FLASH_OFF`, `PULSE 120`
   - `HELP`

5. PC viewer (recommended: **browser**, not Tk on recent macOS Pythons):

   ```bash
   pip install pyserial pillow
   python3 tools/view_serial.py --port /dev/cu.usbserial-0001 --send-init --http
   ```

   Then open **http://127.0.0.1:8766/** (or the port you pass to `--http PORT`). Tk is optional and often missing on Python.org builds.

   On **macOS** use **`/dev/cu.…`**, not **`/dev/tty.…`**. List ports: `python3 tools/view_serial.py --list`.

### If you see no picture

1. **Re-flash** `esp32cam-serial` from this repo (older firmware spammed HELP text over the same UART used for JPEGs and confused the viewer).
2. **Only one program** may open the COM/tty device — quit PlatformIO / Arduino Serial Monitor first.
3. Run with **`--send-init`** so the board receives `STREAM_ON`, or type `STREAM_ON` + Enter in the same terminal running `view_serial.py`.
4. **Brownout:** a weak laptop USB port may prevent the sensor from starting — shorter cable or powered hub.
5. As a fallback, put real Wi‑Fi credentials in **`secrets.h`**, flash **`esp32cam`**, and use **`http://<board-ip>/`** in the browser.



### Binary framing (each frame)

`CA FE 4A 50` (4 bytes) + **uint32 little-endian length** + **JPEG bytes**. Repeat while `STREAM_ON`.

---

## Hardware notes

- **Onboard flash:** GPIO **HIGH** = LED on for typical ESP32-CAM boards.
- **External LED** (IO4 / GND): series resistor (often **68 Ω–150 Ω** from a Li-ion); use a transistor if you need real power.

## Changing boards

If your module differs, replace the `#define` pin block in `src/main.cpp` with the pin map for your variant.

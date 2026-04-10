# Freeway Frenzy – High-Speed Driving Game

![Freeway Frenzy](https://raw.githubusercontent.com/seanwirkus/FreewayFrenzy/main/coverimage.png)

A high-performance driving game for the **ESP32-S3-Touch-LCD-7B** (1024×600 display). Steer your car through traffic using an external ESP32-C3 based joystick controller over UART!

> **[▶ Play in your browser](https://seanwirkus.github.io/FreewayFrenzy/)**

## Project Structure

The project is split into two parts to offload the game logic from the rendering engine:

- **FreewayFrenzy (Main Project)**: Runs on the ESP32-S3. Handles the high-resolution rendering and UI.
- **controller/**: Runs on an ESP32-C3. Handles the physics engine, collision detection, and joystick/sensor inputs.

## Controls

| Action | Control (JoyStick Controller) |
|--------|------------------------------|
| **Steer** | Joystick Left/Right |
| **Accelerate** | Joystick Up |
| **Brake** | Joystick Down |
| **Restart** | Joystick Button (Press) |
| **Day/Night** | Automatic via Photoresistor |

## Build & Flash

### 1. The Game Engine (S3 Display)
```bash
cd FreewayFrenzy
idf.py set-target esp32s3
idf.py build flash monitor
```

### 2. The Controller (C3 Brain)
```bash
cd FreewayFrenzy/controller
idf.py set-target esp32c3
idf.py build flash monitor
```

## How it Works

- **Distributed Engine**: The game logic runs at 30Hz on an ESP32-C3 "brain". It sends a compact world-state packet over UART (460,800 baud) to the S3.
- **High-Res Rendering**: The S3 renderer uses a **LVGL canvas** (1024×600 pixel buffer in PSRAM) to draw the scene at 30+ FPS.
- **Optimization**: Uses pre-computed road templates and `memcpy` row fills for peak performance on the S3's RGB interface.
- **Dynamic Atmosphere**: An on-board photoresistor detects ambient light and automatically toggles a "Night Mode" with a custom color palette.

## Key Files

- `main/main.c`: Display hardware initialization (GT911 touch, RGB LCD, LVGL).
- `main/game_ui.c`: High-resolution rendering engine.
- `main/uart_joystick.c`: High-speed UART receiver for the controller packets.
- `controller/main/main.c`: The core game engine (physics, collisions, spawning, sensors).

## Hardware Note
Project is now self-contained with all necessary drivers included in the `components/` directory.

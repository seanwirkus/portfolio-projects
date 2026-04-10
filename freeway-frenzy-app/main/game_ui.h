/****************************************************************************
 * Freeway Frenzy – High-speed driving game for ESP32-S3 Touch LCD 1024×600
 *
 * game_ui.h – Public types and API
 ***************************************************************************/
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "lvgl.h"

/* ── Joystick state (valid for touch -or- physical ADC stick) ────────── */
typedef struct {
    int steer;     /* -100 (full left) … 0 (center) … +100 (full right) */
    int throttle;  /* -100 (brake)     … 0 (coast)  … +100 (full gas)  */
    bool button;   /* true while the controller select button is held */
} joystick_state_t;

/**
 * @brief Create the game screen and start the ~30 fps game loop timer.
 *        Must be called with the LVGL mutex held.
 */
void game_ui_init(void);

/**
 * @brief Feed the current joystick / touch input to the game.
 *        Called by main.c each frame (or from the touch event handler).
 */
void game_ui_set_joystick(const joystick_state_t *js);

/**
 * @brief Restart the game (reset score, obstacles, position).
 *        Safe to call from any task — sets a flag checked in the game loop.
 */
void game_ui_restart(void);

/**
 * @brief Sync the entire game world state from the C3 controller.
 */
void game_ui_update_from_wire(const void *packet_void);


/****************************************************************************
 * Freeway Frenzy Controller – ESP32-C3 (Game Brain)
 *
 * Reads analog joystick + button, runs all game logic (physics, collisions,
 * obstacle spawning, phase management), and sends a compact world-state
 * packet to the S3 display over UART at ~30 Hz.
 *
 * Buzzer on GPIO3 plays a fixed-tempo melody during gameplay.
 ***************************************************************************/
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "esp_adc/adc_oneshot.h"
#include "driver/gpio.h"
#include "driver/ledc.h"

static const char *TAG = "controller";

/* ── UART ──────────────────────────────────────────────────────────── */
#define UART_PORT     UART_NUM_1
#define PIN_TX        21
#define PIN_RX        20
#define BAUD_RATE     460800

/* ── Joystick pins ─────────────────────────────────────────────────── */
#define PIN_JOY_VRX   ADC_CHANNEL_0
#define PIN_JOY_VRY   ADC_CHANNEL_1
#define PIN_JOY_SW    GPIO_NUM_2

/* ── Buzzer on GPIO3 (was photoresistor) ───────────────────────────── */
#define PIN_BUZZER    GPIO_NUM_3
#define BUZZ_CHANNEL  LEDC_CHANNEL_0
#define BUZZ_TIMER    LEDC_TIMER_0

/* ── Game logic constants (must match S3 renderer) ─────────────────── */
#define LOGIC_W         512
#define LOGIC_H         300
#define NUM_LANES       5
#define LANE_W          50
#define ROAD_W          (NUM_LANES * LANE_W)
#define SHOULDER_W      15
#define ROAD_SURFACE_L  ((LOGIC_W - (ROAD_W + SHOULDER_W * 2)) / 2 + SHOULDER_W)
#define LANE_CX(lane)   (ROAD_SURFACE_L + LANE_W / 2 + (lane) * LANE_W)

#define CAR_W           28
#define CAR_H           45
#define CAR_Y           (LOGIC_H - CAR_H - 15)
#define OBS_W           26
#define OBS_H           42
#define MAX_OBSTACLES   12

#define CRASH_ANIM_US   1200000   /* 1.2 seconds */
#define BOOST_CHARGE_S  4.0f
#define BOOST_RELEASE_S 2.4f
#define BOOST_EXP_K     2.35f
#define BOOST_MIN_GAIN  0.55f
#define BOOST_EXTRA_GAIN 1.75f
#define BOOST_MAX_SPEED 820.0f

/* ── Phases ────────────────────────────────────────────────────────── */
typedef enum {
    PHASE_MENU      = 0,
    PHASE_PLAYING   = 1,
    PHASE_CRASH_ANIM = 2,
    PHASE_GAME_OVER = 3,
} game_phase_t;

/* ── Wire packet (must match S3) ──────────────────────────────────── */
typedef struct __attribute__((packed)) {
    uint8_t  sync;              /* 0xA5 */
    uint8_t  phase;
    int16_t  car_x;
    float    road_scroll;
    float    speed;
    uint32_t score;
    uint32_t distance;
    uint32_t high_score;
    int8_t   crash_obs_lane;    /* lane of crashed obstacle, -1 if none */
    int16_t  crash_obs_y;       /* y of crashed obstacle */
    uint8_t  num_obs;
    struct {
        int16_t y;
        int8_t  lane;
        uint8_t type;
    } obs[MAX_OBSTACLES];
    int8_t   steer;
    int8_t   throttle;
    uint8_t  btn;
    uint8_t  night_mode;        /* kept for packet compat, always 0 */
} world_packet_t;

/* ── Game state ────────────────────────────────────────────────────── */
typedef struct {
    game_phase_t phase;
    float    car_x;
    int      target_lane;
    float    speed;
    float    base_speed;
    float    road_scroll;
    float    distance_f;
    uint32_t distance;
    uint32_t score;
    uint32_t high_score;

    struct {
        float   y;
        int     lane;
        int     type;
        float   traffic_speed;
        bool    active;
    } obs[MAX_OBSTACLES];

    float    last_spawn_dist;
    int      safe_lane_hint;

    /* crash */
    int64_t  crash_start_us;
    int      crash_obs_lane;
    float    crash_obs_y;
    float    crash_speed;

    int64_t  last_lane_change_us;
    float    boost_hold_s;
} game_state_t;

static game_state_t gs;

/* ══════════════════════════════════════════════════════════════════════
 *  BUZZER – ported from the Arduino melody sketch
 * ════════════════════════════════════════════════════════════════════ */

/* Note frequencies (Hz) */
#define NOTE_REST 0
#define NOTE_C4   262
#define NOTE_D4   294
#define NOTE_E4   330
#define NOTE_F4   349
#define NOTE_G4   392
#define NOTE_A4   440
#define NOTE_AS4  466
#define NOTE_C5   523

static const uint16_t melody_notes[] = {
    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4,

    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4, NOTE_REST, NOTE_A4,

    NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4,
    NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4,
    NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4,
    NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4,

    NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4,
    NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4, NOTE_AS4,
    NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4, NOTE_A4,
    NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4, NOTE_G4,

    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_G4, NOTE_F4, NOTE_A4,
    NOTE_G4,
    NOTE_C5, NOTE_A4, NOTE_G4, NOTE_A4, NOTE_C5,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_G4, NOTE_F4, NOTE_A4,
    NOTE_G4,

    NOTE_C5,
    NOTE_C5, NOTE_AS4, NOTE_C5, NOTE_AS4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4,

    NOTE_REST, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_E4, NOTE_D4, NOTE_C4,
    NOTE_D4,
    NOTE_REST, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_E4, NOTE_D4, NOTE_C4,
    NOTE_D4,

    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_G4, NOTE_F4, NOTE_A4,
    NOTE_G4,
    NOTE_C5, NOTE_A4, NOTE_G4, NOTE_A4, NOTE_C5,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_G4, NOTE_F4, NOTE_A4,
    NOTE_G4,

    NOTE_C5,
    NOTE_C5, NOTE_AS4, NOTE_C5, NOTE_AS4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4,

    NOTE_REST, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_E4, NOTE_D4, NOTE_C4,
    NOTE_D4,
    NOTE_REST, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_E4, NOTE_D4, NOTE_C4,
    NOTE_D4,

    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4,

    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_G4, NOTE_F4, NOTE_A4,
    NOTE_G4,
    NOTE_C5, NOTE_A4, NOTE_G4, NOTE_A4, NOTE_C5,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_G4, NOTE_F4, NOTE_A4,
    NOTE_G4,

    NOTE_C5,
    NOTE_C5, NOTE_AS4, NOTE_C5, NOTE_AS4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4,

    NOTE_REST, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_E4, NOTE_D4, NOTE_C4,
    NOTE_D4,
    NOTE_REST, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_E4, NOTE_D4, NOTE_C4,
    NOTE_D4,

    NOTE_F4, NOTE_G4, NOTE_A4, NOTE_G4, NOTE_A4,
    NOTE_AS4, NOTE_A4, NOTE_G4, NOTE_F4, NOTE_G4,
    NOTE_A4, NOTE_C4, NOTE_C4, NOTE_C4, NOTE_C4,
    NOTE_C4
};

static const uint8_t melody_durations[] = {
    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 8, 4, 8, 4,
    1,

    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 8, 4, 8, 4,
    2, 8, 16,

    8, 16, 8, 16, 8, 16, 8, 16,
    8, 16, 8, 16, 8, 16, 8, 16,
    8, 16, 8, 16, 8, 16, 8, 16,
    8, 16, 8, 16, 8, 16, 8, 16,

    8, 16, 8, 16, 8, 16, 8, 16,
    8, 16, 8, 16, 8, 16, 8, 16,
    8, 16, 8, 16, 8, 16, 8, 16,
    8, 16, 8, 16, 8, 16, 8, 16,

    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 4, 4, 4,
    1,
    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 4, 4, 4,
    1,

    1,
    4, 8, 8, 2,
    4, 8, 4, 8, 4,
    1,

    4, 8, 8, 8, 8, 8, 8,
    1,
    4, 8, 8, 8, 8, 8, 8,
    1,

    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 4, 4, 4,
    1,
    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 4, 4, 4,
    1,

    1,
    4, 8, 8, 2,
    4, 8, 4, 8, 4,
    1,

    4, 8, 8, 8, 8, 8, 8,
    1,
    4, 8, 8, 8, 8, 8, 8,
    1,

    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 8, 4, 8, 4,
    1,

    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 4, 4, 4,
    1,
    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 4, 4, 4,
    1,

    1,
    4, 8, 8, 2,
    4, 8, 4, 8, 4,
    1,

    4, 8, 8, 8, 8, 8, 8,
    1,
    4, 8, 8, 8, 8, 8, 8,
    1,

    4, 4, 8, 4, 8,
    4, 4, 8, 4, 8,
    4, 8, 4, 8, 4,
    1
};

#define MELODY_LEN  (sizeof(melody_notes) / sizeof(melody_notes[0]))
_Static_assert(MELODY_LEN == (sizeof(melody_durations) / sizeof(melody_durations[0])),
               "melody and duration arrays must match");

static int  melody_idx = 0;        /* current note index */
static int64_t note_start_us = 0;  /* when current note started */
static bool buzzer_active = false;
static bool note_released = false;

static void buzzer_init(void) {
    ledc_timer_config_t timer_conf = {
        .speed_mode      = LEDC_LOW_SPEED_MODE,
        .duty_resolution = LEDC_TIMER_8_BIT,
        .timer_num       = BUZZ_TIMER,
        .freq_hz         = 1000,
        .clk_cfg         = LEDC_AUTO_CLK,
    };
    ledc_timer_config(&timer_conf);

    ledc_channel_config_t ch_conf = {
        .gpio_num   = PIN_BUZZER,
        .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel    = BUZZ_CHANNEL,
        .timer_sel  = BUZZ_TIMER,
        .duty       = 0,
        .hpoint     = 0,
    };
    ledc_channel_config(&ch_conf);
}

static void buzzer_tone(uint16_t freq) {
    if (freq == 0) {
        ledc_set_duty(LEDC_LOW_SPEED_MODE, BUZZ_CHANNEL, 0);
        ledc_update_duty(LEDC_LOW_SPEED_MODE, BUZZ_CHANNEL);
    } else {
        ledc_set_freq(LEDC_LOW_SPEED_MODE, BUZZ_TIMER, freq);
        ledc_set_duty(LEDC_LOW_SPEED_MODE, BUZZ_CHANNEL, 64); /* softer tone on piezo */
        ledc_update_duty(LEDC_LOW_SPEED_MODE, BUZZ_CHANNEL);
    }
}

static void buzzer_stop(void) {
    ledc_set_duty(LEDC_LOW_SPEED_MODE, BUZZ_CHANNEL, 0);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, BUZZ_CHANNEL);
    buzzer_active = false;
}

/*
 * Advance melody with fixed timing that matches the Arduino sketch:
 * note length = 1000 / duration, slot length = note length * 1.30.
 */
static void buzzer_update(int64_t now_us) {
    if (!buzzer_active) {
        buzzer_active = true;
        melody_idx = 0;
        note_start_us = now_us;
        note_released = false;
        buzzer_tone(melody_notes[0]);
        return;
    }

    int tone_us = 1000000 / melody_durations[melody_idx];
    int slot_us = (tone_us * 13) / 10;
    int64_t elapsed_us = now_us - note_start_us;

    if (!note_released && elapsed_us >= tone_us) {
        buzzer_tone(NOTE_REST);
        note_released = true;
    }

    if (elapsed_us >= slot_us) {
        melody_idx = (melody_idx + 1) % MELODY_LEN;
        note_start_us = now_us;
        note_released = false;
        buzzer_tone(melody_notes[melody_idx]);
    }
}

/* ── Helpers ───────────────────────────────────────────────────────── */

static uint32_t fast_rand(void) {
    static uint32_t s = 12345;
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return s;
}

static void reset_game(void) {
    game_phase_t save_phase = gs.phase;
    uint32_t save_high = gs.high_score;
    float save_scroll = gs.road_scroll;
    memset(&gs, 0, sizeof(gs));
    gs.phase = save_phase;
    gs.high_score = save_high;
    gs.car_x = LANE_CX(2);
    gs.target_lane = 2;
    gs.safe_lane_hint = 2;
    gs.speed = 0;
    gs.base_speed = 75.0f;
    gs.road_scroll = save_scroll;
    gs.crash_obs_lane = -1;
    gs.boost_hold_s = 0.0f;
}

static float normalized_exp_ramp(float t) {
    if (t <= 0.0f) return 0.0f;
    if (t >= 1.0f) return 1.0f;
    return (expf(BOOST_EXP_K * t) - 1.0f) / (expf(BOOST_EXP_K) - 1.0f);
}

/* ── Obstacle spawning ─────────────────────────────────────────────── */

/* How many obstacle cars to allow on screen based on score */
static int max_active_obs(void) {
    /* Start with 1, add 1 every 15 points, cap at 8 */
    int n = 1 + (int)(gs.score / 15);
    if (n > 8) n = 8;
    return n;
}

static int count_active_obs(void) {
    int c = 0;
    for (int i = 0; i < MAX_OBSTACLES; i++)
        if (gs.obs[i].active) c++;
    return c;
}

static bool lane_clear(int lane, float spawn_y) {
    for (int i = 0; i < MAX_OBSTACLES; i++) {
        if (!gs.obs[i].active || gs.obs[i].lane != lane) continue;
        if (fabsf(gs.obs[i].y - spawn_y) < 120.0f) return false;
    }
    return true;
}

static void spawn_one(void) {
    /* Don't exceed difficulty-based cap */
    if (count_active_obs() >= max_active_obs()) return;

    /* Pick a random lane — any lane is fair game */
    int lane = fast_rand() % NUM_LANES;

    /* Make sure there's vertical clearance so cars don't overlap */
    if (!lane_clear(lane, (float)(-OBS_H - 10))) return;

    /* Find a free slot */
    for (int i = 0; i < MAX_OBSTACLES; i++) {
        if (!gs.obs[i].active) {
            gs.obs[i].active = true;
            gs.obs[i].lane = lane;
            gs.obs[i].y = (float)(-OBS_H - 10);
            gs.obs[i].type = fast_rand() % 6;
            gs.obs[i].traffic_speed = 0; /* all same speed – unused now */
            break;
        }
    }
}

/* ── Physics update ────────────────────────────────────────────────── */

static void update_physics(float dt, int steer, int throttle) {

    /* ── MENU: gentle road scroll ──────────────────────────────────── */
    if (gs.phase == PHASE_MENU) {
        gs.road_scroll += 40.0f * dt;
        if (gs.road_scroll > 100000.0f) gs.road_scroll -= 100000.0f;
        gs.speed = 0;
        gs.car_x = LANE_CX(2);
        return;
    }

    /* ── GAME OVER: static ─────────────────────────────────────────── */
    if (gs.phase == PHASE_GAME_OVER) {
        return;
    }

    /* ── CRASH ANIM: decelerate, scroll, then transition ───────────── */
    if (gs.phase == PHASE_CRASH_ANIM) {
        gs.speed *= (1.0f - 3.0f * dt);
        if (gs.speed < 5.0f) gs.speed = 0;
        gs.road_scroll += gs.speed * 2.5f * dt;
        if (gs.road_scroll > 100000.0f) gs.road_scroll -= 100000.0f;

        int64_t now = esp_timer_get_time();
        if (now - gs.crash_start_us >= CRASH_ANIM_US) {
            if (gs.score > gs.high_score) gs.high_score = gs.score;
            gs.phase = PHASE_GAME_OVER;
        }
        return;
    }

    /* ── PLAYING ───────────────────────────────────────────────────── */

    /* Lane changes */
    int64_t now = esp_timer_get_time();
    if (now - gs.last_lane_change_us > 150000) {
        if (steer < -40 && gs.target_lane > 0) {
            gs.target_lane--;
            gs.last_lane_change_us = now;
        }
        if (steer > 40 && gs.target_lane < NUM_LANES - 1) {
            gs.target_lane++;
            gs.last_lane_change_us = now;
        }
    }

    /* Smooth car position */
    float tx = (float)LANE_CX(gs.target_lane);
    float lerp = 12.0f * dt;
    if (lerp > 1.0f) lerp = 1.0f;
    gs.car_x += (tx - gs.car_x) * lerp;

    /* Speed */
    gs.base_speed = 75.0f + gs.distance_f * 0.045f;
    if (gs.base_speed > 250.0f) gs.base_speed = 250.0f;

    float speed_mod = (float)throttle * 0.01f;
    bool boosting = speed_mod > 0.1f;
    if (boosting) {
        gs.boost_hold_s += dt;
        if (gs.boost_hold_s > BOOST_CHARGE_S) gs.boost_hold_s = BOOST_CHARGE_S;
    } else {
        gs.boost_hold_s -= dt * BOOST_RELEASE_S;
        if (gs.boost_hold_s < 0.0f) gs.boost_hold_s = 0.0f;
    }

    float boost_ramp = gs.boost_hold_s / BOOST_CHARGE_S;
    float boost_curve = normalized_exp_ramp(boost_ramp);

    float target_speed;
    if (boosting) {
        float boost_strength = BOOST_MIN_GAIN + boost_curve * BOOST_EXTRA_GAIN;
        target_speed = gs.base_speed * (1.0f + speed_mod * boost_strength);
        if (target_speed > BOOST_MAX_SPEED) target_speed = BOOST_MAX_SPEED;
    } else if (speed_mod < -0.1f) {
        target_speed = gs.base_speed * (1.0f + speed_mod * 0.75f);
        if (target_speed < 15.0f) target_speed = 15.0f;
    } else {
        target_speed = gs.base_speed;
    }
    float sp_lerp = 3.0f;
    if (speed_mod < -0.1f) {
        sp_lerp = 5.0f;
    } else if (boosting) {
        sp_lerp = 3.2f + boost_curve * 2.4f;
    }
    gs.speed += (target_speed - gs.speed) * sp_lerp * dt;
    if (gs.speed < 0) gs.speed = 0;

    /* Scroll / distance */
    gs.road_scroll += gs.speed * 2.5f * dt;
    if (gs.road_scroll > 100000.0f) gs.road_scroll -= 100000.0f;
    gs.distance_f += gs.speed * dt * 0.3f;
    gs.distance = (uint32_t)gs.distance_f;
    gs.score = (uint32_t)(gs.distance_f / 10.0f);

    /* Obstacles: move at uniform speed + spawn */
    gs.last_spawn_dist += gs.speed * 2.0f * dt;

    /* Spawn interval: starts wide, shrinks as score grows */
    float spawn_gap = 140.0f - gs.score * 0.8f;
    if (spawn_gap < 70.0f) spawn_gap = 70.0f;

    if (gs.last_spawn_dist >= spawn_gap) {
        gs.last_spawn_dist -= spawn_gap;
        spawn_one();
    }

    /* All obstacles scroll down at the same speed (relative to player) */
    float obs_speed = gs.speed * 1.8f + 30.0f;
    for (int i = 0; i < MAX_OBSTACLES; i++) {
        if (!gs.obs[i].active) continue;
        gs.obs[i].y += obs_speed * dt;
        if (gs.obs[i].y > LOGIC_H + 50) {
            gs.obs[i].active = false;
        }
    }

    /* Collision detection */
    int car_l = (int)gs.car_x - CAR_W / 2;
    int car_r = (int)gs.car_x + CAR_W / 2;
    int car_t = CAR_Y;
    int car_b = CAR_Y + CAR_H;

    for (int i = 0; i < MAX_OBSTACLES; i++) {
        if (!gs.obs[i].active) continue;
        int ox = LANE_CX(gs.obs[i].lane);
        int ol = ox - OBS_W / 2;
        int or_ = ox + OBS_W / 2;
        int ot = (int)gs.obs[i].y;
        int ob = (int)gs.obs[i].y + OBS_H;

        if (car_l < or_ && car_r > ol && car_t < ob && car_b > ot) {
            /* CRASH! */
            gs.phase = PHASE_CRASH_ANIM;
            gs.crash_start_us = now;
            gs.crash_speed = gs.speed;
            gs.crash_obs_lane = gs.obs[i].lane;
            gs.crash_obs_y = gs.obs[i].y;
            return;
        }
    }
}

/* ── Main task ─────────────────────────────────────────────────────── */

static void uart_game_engine_task(void *pvParameters)
{
    /* UART init */
    uart_config_t uart_config = {
        .baud_rate = BAUD_RATE,
        .data_bits = UART_DATA_8_BITS,
        .parity    = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    uart_driver_install(UART_PORT, 256, 0, 0, NULL, 0);
    uart_param_config(UART_PORT, &uart_config);
    uart_set_pin(UART_PORT, PIN_TX, PIN_RX, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

    /* ADC init */
    adc_oneshot_unit_handle_t adc1_handle;
    adc_oneshot_unit_init_cfg_t init_config1 = { .unit_id = ADC_UNIT_1 };
    adc_oneshot_new_unit(&init_config1, &adc1_handle);
    adc_oneshot_chan_cfg_t config = { .bitwidth = ADC_BITWIDTH_DEFAULT, .atten = ADC_ATTEN_DB_12 };
    adc_oneshot_config_channel(adc1_handle, PIN_JOY_VRX, &config);
    adc_oneshot_config_channel(adc1_handle, PIN_JOY_VRY, &config);
    gpio_set_direction(PIN_JOY_SW, GPIO_MODE_INPUT);
    gpio_pullup_en(PIN_JOY_SW);

    /* Buzzer init */
    buzzer_init();

    reset_game();
    gs.phase = PHASE_MENU;
    int center_x = 2048, center_y = 2048;
    bool prev_btn = false;

    ESP_LOGI(TAG, "Game engine started. UART baud=%d, buzzer on GPIO%d", BAUD_RATE, PIN_BUZZER);

    while (1) {
        int64_t now_us = esp_timer_get_time();
        int vx = 0, vy = 0;
        adc_oneshot_read(adc1_handle, PIN_JOY_VRX, &vx);
        adc_oneshot_read(adc1_handle, PIN_JOY_VRY, &vy);

        int steer    = (vx - center_x) / 16;
        int throttle = -(vy - center_y) / 16;
        if (steer > 100) steer = 100;
        if (steer < -100) steer = -100;
        if (throttle > 100) throttle = 100;
        if (throttle < -100) throttle = -100;

        bool btn = gpio_get_level(PIN_JOY_SW) == 0;
        bool btn_edge = btn && !prev_btn;
        prev_btn = btn;

        /* Phase transitions from button */
        if (btn_edge) {
            if (gs.phase == PHASE_MENU) {
                reset_game();
                gs.phase = PHASE_PLAYING;
            } else if (gs.phase == PHASE_GAME_OVER) {
                reset_game();
                gs.phase = PHASE_PLAYING;
            }
        }

        update_physics(0.033f, steer, throttle);

        /* Buzzer: play Tokyo Drift during gameplay, stop otherwise */
        if (gs.phase == PHASE_PLAYING || gs.phase == PHASE_CRASH_ANIM) {
            buzzer_update(now_us);
        } else if (buzzer_active) {
            buzzer_stop();
        }

        /* Build packet */
        world_packet_t pkt;
        memset(&pkt, 0, sizeof(pkt));
        pkt.sync       = 0xA5;
        pkt.phase      = (uint8_t)gs.phase;
        pkt.car_x      = (int16_t)gs.car_x;
        pkt.road_scroll = gs.road_scroll;
        pkt.speed      = gs.speed;
        pkt.score      = gs.score;
        pkt.distance   = gs.distance;
        pkt.high_score = gs.high_score;
        pkt.crash_obs_lane = (int8_t)gs.crash_obs_lane;
        pkt.crash_obs_y    = (int16_t)gs.crash_obs_y;
        pkt.steer      = (int8_t)steer;
        pkt.throttle   = (int8_t)throttle;
        pkt.btn        = (uint8_t)btn;
        pkt.night_mode = 0; /* no longer used */

        int obs_count = 0;
        for (int i = 0; i < MAX_OBSTACLES && obs_count < MAX_OBSTACLES; i++) {
            if (!gs.obs[i].active) continue;
            pkt.obs[obs_count].y    = (int16_t)gs.obs[i].y;
            pkt.obs[obs_count].lane = (int8_t)gs.obs[i].lane;
            pkt.obs[obs_count].type = (uint8_t)gs.obs[i].type;
            obs_count++;
        }
        pkt.num_obs = (uint8_t)obs_count;

        uart_write_bytes(UART_PORT, (const char *)&pkt, sizeof(pkt));

        vTaskDelay(pdMS_TO_TICKS(33));
    }
}

void app_main(void)
{
    nvs_flash_init();
    xTaskCreate(uart_game_engine_task, "game_engine", 4096, NULL, 5, NULL);
}

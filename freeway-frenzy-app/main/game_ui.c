/****************************************************************************
 * Freeway Frenzy – High-resolution ESP32-S3 Display
 *
 * game_ui.c – Receives world state from C3 over UART and renders at
 * native 1024×600 (no software zoom).  C3 coordinates (512×300) are
 * scaled 2× on receive.  NO local game logic.
 *
 * OPTIMISED: pre-computed road template, memcpy row fills, integer math,
 *            thread-safe double-buffer for UART→render handoff.
 ***************************************************************************/

#include "game_ui.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static const char *TAG = "freeway_render";

/* ── Display / render constants ───────────────────────────────────── */
#define SCR_W   1024
#define SCR_H   600

/* C3 sends coordinates in 512×300 space – scale factor to native */
#define C3_SCALE  2

/* ── Road geometry (native 1024×600) ──────────────────────────────── */
#define NUM_LANES       5
#define LANE_W          100
#define ROAD_W          (NUM_LANES * LANE_W)
#define SHOULDER_W      30
#define TOTAL_ROAD_W    (ROAD_W + SHOULDER_W * 2)
#define ROAD_LEFT       ((SCR_W - TOTAL_ROAD_W) / 2)
#define ROAD_SURFACE_L  (ROAD_LEFT + SHOULDER_W)
#define ROAD_SURFACE_R  (ROAD_SURFACE_L + ROAD_W)
#define ROAD_RIGHT      (ROAD_LEFT + TOTAL_ROAD_W)
#define LANE_CX(lane)   (ROAD_SURFACE_L + LANE_W / 2 + (lane) * LANE_W)

/* Lane markings */
#define MARK_W          4
#define DASH_LEN        40
#define GAP_LEN         30
#define DASH_CYCLE      (DASH_LEN + GAP_LEN)

/* Car geometry */
#define CAR_W           56
#define CAR_H           90
#define CAR_Y           (SCR_H - CAR_H - 30)
#define OBS_W           52
#define OBS_H           84
#define MAX_OBSTACLES   12

/* ── Phases (must match C3) ───────────────────────────────────────── */
typedef enum {
    PHASE_MENU       = 0,
    PHASE_PLAYING    = 1,
    PHASE_CRASH_ANIM = 2,
    PHASE_GAME_OVER  = 3,
} game_phase_t;

/* ── Wire packet (must match C3) ──────────────────────────────────── */
typedef struct __attribute__((packed)) {
    uint8_t  sync;
    uint8_t  phase;
    int16_t  car_x;
    float    road_scroll;
    float    speed;
    uint32_t score;
    uint32_t distance;
    uint32_t high_score;
    int8_t   crash_obs_lane;
    int16_t  crash_obs_y;
    uint8_t  num_obs;
    struct {
        int16_t y;
        int8_t  lane;
        uint8_t type;
    } obs[MAX_OBSTACLES];
    int8_t   steer;
    int8_t   throttle;
    uint8_t  btn;
    uint8_t  night_mode;
} wire_packet_t;

/* ── Obstacle render state ────────────────────────────────────────── */
typedef struct {
    bool  active;
    int   lane;
    float y;
    int   type;
} obs_render_t;

/* ── Crash debris particle ────────────────────────────────────────── */
#define MAX_DEBRIS    10
#define CRASH_ANIM_US 1200000

typedef struct {
    bool  active;
    float x, y;
    float vx, vy;
    float size;
    lv_color_t color;
} debris_t;

/* ── Render state (written from UART, read by LVGL timer) ─────────── */
typedef struct {
    game_phase_t phase;
    game_phase_t prev_phase;

    /* world state from C3 */
    float    car_x;
    float    road_scroll;
    float    speed;
    uint32_t score;
    uint32_t distance;
    uint32_t high_score;
    int      steer;
    int      throttle;
    obs_render_t obs[MAX_OBSTACLES];
    int      num_obs;

    /* crash */
    int8_t   crash_obs_lane;
    int16_t  crash_obs_y;
    int64_t  crash_start_us;
    float    crash_speed;
    float    crash_player_dx, crash_player_dy;
    float    crash_obs_dx, crash_obs_dy;
    float    shake_offset_x, shake_offset_y;
    debris_t debris[MAX_DEBRIS];

    /* menu animation */
    float    menu_scroll;

    /* connection state */
    bool     c3_connected;
    int64_t  last_packet_us;

    /* menu / game-over selection */
    int      menu_selection;
    int      go_selection;
    int64_t  last_ui_nav_us;
    int64_t  phase_enter_us;

    /* HUD cache (only update LVGL labels when values change) */
    int      hud_speed;
    uint32_t hud_score;
    uint32_t hud_distance;

    /* day/night from photoresistor */
    bool     night;
} render_state_t;

static render_state_t rs;

/* ── Thread-safe packet handoff ───────────────────────────────────── */
static wire_packet_t   pkt_buf;          /* written by UART task */
static volatile bool   pkt_ready = false; /* flag: new packet available */
static SemaphoreHandle_t pkt_mutex;

/* ── LVGL objects ─────────────────────────────────────────────────── */
static lv_color_t *canvas_buf;   /* points to LVGL framebuffer each frame */
static lv_obj_t   *scr_main;

/* HUD */
static lv_obj_t *speed_label;
static lv_obj_t *score_label;
static lv_obj_t *gear_label;
static lv_obj_t *wifi_label;

/* Menu overlay */
static lv_obj_t *menu_panel;
static lv_obj_t *menu_title;
static lv_obj_t *menu_subtitle;
static lv_obj_t *menu_highscore;
static lv_obj_t *menu_color_row;
static lv_obj_t *menu_color_arrow_l;
static lv_obj_t *menu_color_swatch;
static lv_obj_t *menu_color_name;
static lv_obj_t *menu_color_arrow_r;
static lv_obj_t *menu_play_btn;

/* Game over overlay */
static lv_obj_t *go_panel;
static lv_obj_t *go_title;
static lv_obj_t *go_score_label;
static lv_obj_t *go_high_label;
static lv_obj_t *go_distance_label;
static lv_obj_t *go_retry_btn;
static lv_obj_t *go_menu_btn;

static lv_timer_t *game_timer;

/* ── Colour palette (dark/monochrome environment, vivid cars) ──────── */
#define COL_GRASS_1    lv_color_hex(0x0A0A0A)
#define COL_GRASS_2    lv_color_hex(0x080808)
#define COL_ROAD       lv_color_hex(0x181818)
#define COL_SHOULDER   lv_color_hex(0x222222)
#define COL_LANE_MARK  lv_color_hex(0x444444)
#define COL_CAR_WIND   lv_color_hex(0x8ECAE6)
#define COL_HEADLIGHT  lv_color_hex(0xFFFF99)
#define COL_TAILLIGHT  lv_color_hex(0xFF0000)
#define COL_SHADOW     lv_color_hex(0x050505)
#define COL_HUD_BG     lv_color_hex(0x0A0A0A)

/* Night-mode palette (even darker) */
#define COL_GRASS_1_N   lv_color_hex(0x060606)
#define COL_GRASS_2_N   lv_color_hex(0x040404)
#define COL_ROAD_N      lv_color_hex(0x101010)
#define COL_SHOULDER_N  lv_color_hex(0x1A1A1A)
#define COL_LANE_MARK_N lv_color_hex(0x333333)

/* ── Car colour presets ──────────────────────────────────────────── */
#define NUM_CAR_COLORS  8
typedef struct {
    const char *name;
    lv_color_t body;
    lv_color_t roof;
} car_color_t;

static car_color_t car_colors[NUM_CAR_COLORS];
static int selected_car_color = 0;

static void init_car_colors(void) {
    car_colors[0] = (car_color_t){ "Crimson",    lv_color_hex(0xD90429), lv_color_hex(0xA3031F) };
    car_colors[1] = (car_color_t){ "Ocean Blue", lv_color_hex(0x1E90FF), lv_color_hex(0x1565C0) };
    car_colors[2] = (car_color_t){ "Lime",       lv_color_hex(0x32CD32), lv_color_hex(0x228B22) };
    car_colors[3] = (car_color_t){ "Gold",       lv_color_hex(0xFFD700), lv_color_hex(0xDAA520) };
    car_colors[4] = (car_color_t){ "Purple",     lv_color_hex(0x9B59B6), lv_color_hex(0x7D3C98) };
    car_colors[5] = (car_color_t){ "Hot Pink",   lv_color_hex(0xFF69B4), lv_color_hex(0xDB2777) };
    car_colors[6] = (car_color_t){ "Orange",     lv_color_hex(0xFF8C00), lv_color_hex(0xCC7000) };
    car_colors[7] = (car_color_t){ "Silver",     lv_color_hex(0xC0C0C0), lv_color_hex(0x909090) };
}

static lv_color_t obs_colors[6];

static void init_obs_colors(void) {
    obs_colors[0] = lv_color_hex(0x1E90FF);
    obs_colors[1] = lv_color_hex(0xFFD700);
    obs_colors[2] = lv_color_hex(0x32CD32);
    obs_colors[3] = lv_color_hex(0xFF6347);
    obs_colors[4] = lv_color_hex(0x9370DB);
    obs_colors[5] = lv_color_hex(0xE0E0E0);
}

/* ── Full-width row templates (plain / dashed) ─────────────────────── */
static lv_color_t row_template[2][SCR_W];

static void precompute_road_templates(bool night) {
    lv_color_t grass_1  = night ? COL_GRASS_1_N : COL_GRASS_1;
    lv_color_t grass_2  = night ? COL_GRASS_2_N : COL_GRASS_2;
    lv_color_t road_col = night ? COL_ROAD_N : COL_ROAD;
    lv_color_t shoulder = night ? COL_SHOULDER_N : COL_SHOULDER;
    lv_color_t edge     = night ? lv_color_hex(0x222222) : lv_color_hex(0x333333);
    lv_color_t mark     = night ? COL_LANE_MARK_N : COL_LANE_MARK;

    for (int t = 0; t < 2; t++) {
        lv_color_t grass = t == 0 ? grass_1 : grass_2;

        for (int x = 0; x < SCR_W; x++) row_template[t][x] = grass;
        for (int x = ROAD_LEFT; x < ROAD_RIGHT; x++) row_template[t][x] = road_col;
        for (int x = ROAD_LEFT; x < ROAD_SURFACE_L; x++) row_template[t][x] = shoulder;
        for (int x = ROAD_SURFACE_R; x < ROAD_RIGHT; x++) row_template[t][x] = shoulder;

        for (int dx = 0; dx < 3; dx++) {
            int xl = ROAD_SURFACE_L - 4 + dx;
            int xr = ROAD_SURFACE_R + 1 + dx;
            if (xl >= 0 && xl < SCR_W) row_template[t][xl] = edge;
            if (xr >= 0 && xr < SCR_W) row_template[t][xr] = edge;
        }

        if (t == 1) {
            for (int ld = 1; ld < NUM_LANES; ld++) {
                int cx = ROAD_SURFACE_L + ld * LANE_W;
                row_template[t][cx - 1] = mark;
                row_template[t][cx]     = mark;
                row_template[t][cx + 1] = mark;
            }
        }
    }
}

/* Re-fill grass on both framebuffers (called on day/night change) */
static void refill_grass(bool night) {
    lv_color_t grass = night ? COL_GRASS_1_N : COL_GRASS_1;
    lv_disp_t *disp = lv_disp_get_default();
    if (!disp) return;
    lv_color_t *fb1 = (lv_color_t *)disp->driver->draw_buf->buf1;
    lv_color_t *fb2 = (lv_color_t *)disp->driver->draw_buf->buf2;
    int total = SCR_W * SCR_H;
    for (int i = 0; i < total; i++) fb1[i] = grass;
    if (fb2 && fb2 != fb1) {
        for (int i = 0; i < total; i++) fb2[i] = grass;
    }
}

/* ══════════════════════════════════════════════════════════════════════
 *  DRAWING HELPERS
 * ════════════════════════════════════════════════════════════════════ */

static void fill_rect(int rx, int ry, int rw, int rh, lv_color_t c) {
    if (!canvas_buf) return;
    if (rx < 0) { rw += rx; rx = 0; }
    if (ry < 0) { rh += ry; ry = 0; }
    if (rx + rw > SCR_W) rw = SCR_W - rx;
    if (ry + rh > SCR_H) rh = SCR_H - ry;
    if (rw <= 0 || rh <= 0) return;

    lv_color_t *row0 = canvas_buf + ry * SCR_W + rx;
    for (int i = 0; i < rw; i++) row0[i] = c;
    for (int y = 1; y < rh; y++)
        memcpy(row0 + y * SCR_W, row0, rw * sizeof(lv_color_t));
}

/* ══════════════════════════════════════════════════════════════════════
 *  SCENE DRAWING
 * ════════════════════════════════════════════════════════════════════ */

static void draw_road(void) {
    if (!canvas_buf) return;
    int scroll_int = (int)rs.road_scroll;

    for (int y = 0; y < SCR_H; y++) {
        lv_color_t *row = canvas_buf + y * SCR_W;
        int dash_pos = ((y - scroll_int) % DASH_CYCLE + DASH_CYCLE) % DASH_CYCLE;
        int template_idx = (dash_pos < DASH_LEN) ? 1 : 0;
        memcpy(row, row_template[template_idx], SCR_W * sizeof(lv_color_t));
    }
}

static void draw_car(int cx, int cy, int w, int h,
                     lv_color_t body, lv_color_t roof, bool is_player) {
    int x0 = cx - w / 2;
    fill_rect(x0 + 2, cy + 2, w, h, COL_SHADOW);
    fill_rect(x0, cy, w, h, body);

    int ri = w / 4;
    fill_rect(x0 + ri, cy + h / 4, w - ri * 2, h / 3, roof);

    int ws_h = h / 6;
    if (is_player) {
        fill_rect(x0 + ri + 1, cy + 4, w - ri * 2 - 2, ws_h, COL_CAR_WIND);
    } else {
        fill_rect(x0 + ri + 1, cy + h - ws_h - 5, w - ri * 2 - 2, ws_h, COL_CAR_WIND);
    }

    int tl = 5, th = 3;
    fill_rect(x0 + 2, cy + h - th - 1, tl, th, COL_TAILLIGHT);
    fill_rect(x0 + w - tl - 2, cy + h - th - 1, tl, th, COL_TAILLIGHT);

    if (is_player) {
        fill_rect(x0 + 2, cy + 1, 4, 2, COL_HEADLIGHT);
        fill_rect(x0 + w - 6, cy + 1, 4, 2, COL_HEADLIGHT);
        /* Night: single headlight glow (cheap) */
        if (rs.night) {
            lv_color_t glow = lv_color_hex(0x888860);
            int gw = 18;
            fill_rect(cx - gw / 2, cy - 20, gw, 14, glow);
        }
    }
}

static void draw_car_damaged(int cx, int cy, int w, int h,
                              lv_color_t body, float progress, bool is_player) {
    int x0 = cx - w / 2;
    fill_rect(x0 + 2, cy + 2, w, h, COL_SHADOW);

    int cv = (int)(progress * 8.0f);
    int ch = (int)(progress * 3.0f);
    int dw = w + ch, dh = h - cv;
    if (dh < h / 2) dh = h / 2;
    int dx0 = cx - dw / 2;

    lv_color_t dmg = lv_color_mix(body, lv_color_hex(0x333333),
                                   (lv_opa_t)(255 - (int)(progress * 120)));
    fill_rect(dx0, cy, dw, dh, dmg);

    int crush = (int)(progress * 12.0f);
    if (crush > 2) {
        lv_color_t dark = lv_color_hex(0x1A1A1A);
        if (is_player)
            fill_rect(dx0 + 2, cy, dw - 4, crush, dark);
        else
            fill_rect(dx0 + 2, cy + dh - crush, dw - 4, crush, dark);
    }

    if (progress < 0.8f && (esp_random() % 3) != 0) {
        lv_color_t fire[] = { lv_color_hex(0xFF4400), lv_color_hex(0xFFAA00), lv_color_hex(0xFF0000) };
        int fw = 4 + (int)(esp_random() % 6);
        int fh = 3 + (int)(esp_random() % 5);
        int fx = cx - fw / 2 + (int)(esp_random() % 8) - 4;
        int fy = is_player ? (cy - fh) : (cy + dh);
        fill_rect(fx, fy, fw, fh, fire[esp_random() % 3]);
    }
}

static void draw_player(void) {
    draw_car((int)rs.car_x, CAR_Y, CAR_W, CAR_H,
             car_colors[selected_car_color].body,
             car_colors[selected_car_color].roof, true);
}

static void draw_obstacles(void) {
    for (int i = 0; i < rs.num_obs; i++) {
        obs_render_t *o = &rs.obs[i];
        if (!o->active) continue;
        int cy = (int)o->y;
        if (cy + OBS_H < 0 || cy > SCR_H) continue;
        int cx = LANE_CX(o->lane);
        lv_color_t body = obs_colors[o->type % 6];
        draw_car(cx, cy, OBS_W, OBS_H, body, lv_color_hex(0x111111), false);
    }
}

/* Speed lines removed – negligible visual impact on dark theme,
 * and writing to the grass area would require re-clearing it each frame. */

/* ── Crash visual effects (local to S3) ───────────────────────────── */

static void spawn_debris(int cx, int cy, float speed) {
    lv_color_t colors[] = {
        lv_color_hex(0xFF4400), lv_color_hex(0xFFAA00), lv_color_hex(0xFF0000),
        lv_color_hex(0xCCCCCC), lv_color_hex(0x888888), lv_color_hex(0xFFFF44),
    };
    for (int i = 0; i < MAX_DEBRIS; i++) {
        debris_t *d = &rs.debris[i];
        d->active = true;
        d->x = (float)cx + (float)((int)(esp_random() % 30) - 15);
        d->y = (float)cy + (float)((int)(esp_random() % 30) - 15);
        float angle = (float)(esp_random() % 628) / 100.0f;
        float mag = 60.0f + (float)(esp_random() % (int)(speed * 1.2f + 40));
        d->vx = cosf(angle) * mag;
        d->vy = sinf(angle) * mag;
        d->size = 2.0f + (float)(esp_random() % 6);
        d->color = colors[esp_random() % 6];
    }
}

static void update_debris(float dt) {
    for (int i = 0; i < MAX_DEBRIS; i++) {
        debris_t *d = &rs.debris[i];
        if (!d->active) continue;
        d->x += d->vx * dt;
        d->y += d->vy * dt;
        d->vy += 200.0f * dt;
        d->vx *= 0.97f;
        d->size -= 2.5f * dt;
        if (d->size <= 0.5f || d->y > SCR_H + 20) d->active = false;
    }
}

static void draw_debris(void) {
    for (int i = 0; i < MAX_DEBRIS; i++) {
        debris_t *d = &rs.debris[i];
        if (!d->active) continue;
        int s = (int)d->size;
        if (s < 1) s = 1;
        fill_rect((int)d->x, (int)d->y, s, s, d->color);
    }
}

/* ── Full scene draw ──────────────────────────────────────────────── */

static void draw_scene(void) {
    if (!canvas_buf) return;
    draw_road();
    draw_obstacles();

    if (rs.phase == PHASE_CRASH_ANIM) {
        float elapsed = (float)(esp_timer_get_time() - rs.crash_start_us) / (float)CRASH_ANIM_US;
        if (elapsed > 1.0f) elapsed = 1.0f;

        /* Skid marks */
        lv_color_t skid = lv_color_hex(0x222222);
        int skid_len = (int)(elapsed * 60.0f);
        int pcx = (int)(rs.car_x + rs.crash_player_dx);
        int pcy = CAR_Y + (int)rs.crash_player_dy;
        fill_rect(pcx - 8, pcy, 3, skid_len, skid);
        fill_rect(pcx + 5, pcy, 3, skid_len, skid);

        /* Damaged player */
        draw_car_damaged(pcx, pcy, CAR_W, CAR_H,
                         car_colors[selected_car_color].body, elapsed, true);

        /* Damaged obstacle */
        if (rs.crash_obs_lane >= 0 && rs.crash_obs_lane < NUM_LANES) {
            int ocx = LANE_CX(rs.crash_obs_lane) + (int)rs.crash_obs_dx;
            int ocy = (int)rs.crash_obs_y + (int)rs.crash_obs_dy;
            draw_car_damaged(ocx, ocy, OBS_W, OBS_H, lv_color_hex(0x888888), elapsed, false);
        }

        draw_debris();
    } else {
        draw_player();
    }
}

/* ══════════════════════════════════════════════════════════════════════
 *  PHASE / UI MANAGEMENT
 * ════════════════════════════════════════════════════════════════════ */

static void show_hud(bool visible) {
    lv_obj_t *hud[] = { speed_label, score_label, gear_label, wifi_label };
    for (int i = 0; i < 4; i++) {
        if (visible) lv_obj_clear_flag(hud[i], LV_OBJ_FLAG_HIDDEN);
        else         lv_obj_add_flag(hud[i], LV_OBJ_FLAG_HIDDEN);
    }
}

static void hide_all_overlays(void) {
    lv_obj_add_flag(menu_panel, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(go_panel, LV_OBJ_FLAG_HIDDEN);
}

static void switch_phase(game_phase_t new_phase) {
    rs.phase = new_phase;
    rs.phase_enter_us = esp_timer_get_time();
    rs.last_ui_nav_us = rs.phase_enter_us;

    hide_all_overlays();

    switch (new_phase) {
    case PHASE_MENU:
        show_hud(false);
        if (rs.high_score > 0) {
            lv_label_set_text_fmt(menu_highscore, "High Score: %lu", (unsigned long)rs.high_score);
            lv_obj_clear_flag(menu_highscore, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_add_flag(menu_highscore, LV_OBJ_FLAG_HIDDEN);
        }
        lv_obj_clear_flag(menu_panel, LV_OBJ_FLAG_HIDDEN);
        break;

    case PHASE_PLAYING:
        show_hud(true);
        rs.hud_speed = -1;
        rs.hud_score = UINT32_MAX;
        break;

    case PHASE_CRASH_ANIM:
        show_hud(true);
        rs.crash_start_us = esp_timer_get_time();
        rs.crash_player_dx = 0;
        rs.crash_player_dy = 0;
        rs.crash_obs_dx = 0;
        rs.crash_obs_dy = 0;
        rs.crash_speed = rs.speed;
        /* Spawn debris at impact point */
        {
            int impact_x, impact_y;
            if (rs.crash_obs_lane >= 0 && rs.crash_obs_lane < NUM_LANES) {
                impact_x = ((int)rs.car_x + LANE_CX(rs.crash_obs_lane)) / 2;
                impact_y = ((int)rs.crash_obs_y + OBS_H + CAR_Y) / 2;
            } else {
                impact_x = (int)rs.car_x;
                impact_y = CAR_Y;
            }
            spawn_debris(impact_x, impact_y, rs.speed);
        }
        break;

    case PHASE_GAME_OVER:
        show_hud(false);
        rs.go_selection = 0;
        lv_label_set_text_fmt(go_score_label, "Score: %lu", (unsigned long)rs.score);
        lv_label_set_text_fmt(go_high_label, "Best: %lu", (unsigned long)rs.high_score);
        lv_label_set_text_fmt(go_distance_label, "Distance: %lu m", (unsigned long)rs.distance);
        lv_obj_clear_flag(go_panel, LV_OBJ_FLAG_HIDDEN);
        break;
    }
}

/* ══════════════════════════════════════════════════════════════════════
 *  SCENE DRAW EVENT – renders directly to LVGL framebuffer (zero-copy)
 * ════════════════════════════════════════════════════════════════════ */

static void scene_draw_event_cb(lv_event_t *e) {
    lv_draw_ctx_t *draw_ctx = lv_event_get_draw_ctx(e);
    canvas_buf = (lv_color_t *)draw_ctx->buf;

    switch (rs.phase) {
    case PHASE_MENU:
        draw_road();
        draw_player();
        break;
    case PHASE_GAME_OVER:
        draw_road();
        draw_obstacles();
        break;
    case PHASE_PLAYING:
    case PHASE_CRASH_ANIM:
        draw_scene();
        break;
    }
}

/* ══════════════════════════════════════════════════════════════════════
 *  GAME LOOP – state update + trigger refresh, ~60 fps
 * ════════════════════════════════════════════════════════════════════ */

static int64_t last_frame_us;

static void game_loop_cb(lv_timer_t *timer) {
    (void)timer;
    int64_t now_us = esp_timer_get_time();
    float dt = (float)(now_us - last_frame_us) / 1000000.0f;
    if (dt > 0.1f) dt = 0.1f;
    last_frame_us = now_us;

    /* ── Receive world state from C3 ──────────────────────────────── */
    if (pkt_ready && xSemaphoreTake(pkt_mutex, 0) == pdTRUE) {
        wire_packet_t pkt;
        memcpy(&pkt, (void *)&pkt_buf, sizeof(pkt));
        pkt_ready = false;
        xSemaphoreGive(pkt_mutex);

        rs.last_packet_us = now_us;
        rs.c3_connected = true;

        /* Detect day/night change from photoresistor */
        bool new_night = pkt.night_mode != 0;
        if (new_night != rs.night) {
            rs.night = new_night;
            precompute_road_templates(rs.night);
            refill_grass(rs.night);
            ESP_LOGI(TAG, "Mode: %s", rs.night ? "NIGHT" : "DAY");
        }

        /* Detect phase change */
        game_phase_t new_phase = (game_phase_t)pkt.phase;
        if (new_phase != rs.phase) {
            switch_phase(new_phase);
        }

        /* Copy world state – scale C3 coordinates (512×300) to native (1024×600) */
        rs.car_x       = (float)pkt.car_x * C3_SCALE;
        rs.road_scroll = pkt.road_scroll * C3_SCALE;
        rs.speed       = pkt.speed;
        rs.score       = pkt.score;
        rs.distance    = pkt.distance;
        rs.high_score  = pkt.high_score;
        rs.steer       = pkt.steer;
        rs.throttle    = pkt.throttle;
        rs.crash_obs_lane = pkt.crash_obs_lane;
        rs.crash_obs_y = (float)pkt.crash_obs_y * C3_SCALE;

        /* Copy obstacles – scale Y positions */
        rs.num_obs = pkt.num_obs;
        for (int i = 0; i < MAX_OBSTACLES; i++) {
            if (i < pkt.num_obs) {
                rs.obs[i].active = true;
                rs.obs[i].y    = (float)pkt.obs[i].y * C3_SCALE;
                rs.obs[i].lane = pkt.obs[i].lane;
                rs.obs[i].type = pkt.obs[i].type;
            } else {
                rs.obs[i].active = false;
            }
        }
    }

    /* Check C3 connection timeout */
    if (rs.c3_connected && (now_us - rs.last_packet_us > 2000000)) {
        rs.c3_connected = false;
    }

    /* Update connection label (only when state changes) */
    {
        static bool last_connected = false;
        if (rs.c3_connected != last_connected) {
            last_connected = rs.c3_connected;
            if (rs.c3_connected) {
                lv_label_set_text(wifi_label, "Controller: Connected");
                lv_obj_set_style_text_color(wifi_label, lv_color_hex(0x00FF00), 0);
            } else {
                lv_label_set_text(wifi_label, "Controller: Disconnected");
                lv_obj_set_style_text_color(wifi_label, lv_color_hex(0xFF6666), 0);
            }
        }
    }

    /* ── Phase-specific rendering ─────────────────────────────────── */

    if (rs.phase == PHASE_MENU) {
        /* Animate road gently even without C3 */
        if (!rs.c3_connected) {
            rs.menu_scroll += 80.0f * dt;
            if (rs.menu_scroll > 100000.0f) rs.menu_scroll -= 100000.0f;
            rs.road_scroll = rs.menu_scroll;
            rs.car_x = LANE_CX(NUM_LANES / 2);
        }

        /* Joystick left/right to cycle car colour */
        {
            static bool steer_held = false;
            if (rs.steer < -40 || rs.steer > 40) {
                if (!steer_held && (now_us - rs.last_ui_nav_us > 300000)) {
                    rs.last_ui_nav_us = now_us;
                    steer_held = true;
                    if (rs.steer < -40)
                        selected_car_color = (selected_car_color + NUM_CAR_COLORS - 1) % NUM_CAR_COLORS;
                    else
                        selected_car_color = (selected_car_color + 1) % NUM_CAR_COLORS;
                    /* Update swatch + name */
                    lv_obj_set_style_bg_color(menu_color_swatch,
                                              car_colors[selected_car_color].body, 0);
                    lv_label_set_text(menu_color_name, car_colors[selected_car_color].name);
                }
            } else {
                steer_held = false;
            }
        }

        lv_obj_invalidate(scr_main);
        return;
    }

    if (rs.phase == PHASE_GAME_OVER) {
        lv_obj_invalidate(scr_main);
        return;
    }

    if (rs.phase == PHASE_CRASH_ANIM) {
        float elapsed = (float)(now_us - rs.crash_start_us) / (float)CRASH_ANIM_US;
        if (elapsed > 1.0f) elapsed = 1.0f;

        update_debris(dt);

        /* Push cars apart visually */
        float push = rs.crash_speed * 0.5f;
        rs.crash_player_dy += push * 0.3f * dt;
        rs.crash_player_dx += push * 0.1f * dt;
        rs.crash_obs_dy -= push * 0.4f * dt;
        rs.crash_obs_dx -= push * 0.05f * dt;

        /* Decaying screen shake */
        float shake = (1.0f - elapsed) * (rs.crash_speed / 40.0f);
        if (shake > 8.0f) shake = 8.0f;
        rs.shake_offset_x = ((float)((int)(esp_random() % 200) - 100) / 100.0f) * shake;
        rs.shake_offset_y = ((float)((int)(esp_random() % 200) - 100) / 100.0f) * shake;

        /* Scene drawn in scene_draw_event_cb */
        lv_obj_invalidate(scr_main);

        /* Update speed label */
        lv_label_set_text_fmt(speed_label, "%d km/h", (int)rs.speed);
        return;
    }

    /* ── PHASE_PLAYING: scene drawn in scene_draw_event_cb ────────── */
    lv_obj_invalidate(scr_main);

    /* Update HUD only when values change (avoids LVGL layout recalc) */
    int spd = (int)rs.speed;
    if (spd != rs.hud_speed) {
        rs.hud_speed = spd;
        lv_label_set_text_fmt(speed_label, "%d km/h", spd);
    }
    if (rs.score != rs.hud_score || rs.distance != rs.hud_distance) {
        rs.hud_score = rs.score;
        rs.hud_distance = rs.distance;
        lv_label_set_text_fmt(score_label, "Score: %lu  |  %lu m",
                              (unsigned long)rs.score, (unsigned long)rs.distance);
    }

    if (rs.throttle > 30) {
        lv_label_set_text(gear_label, "BOOST");
        lv_obj_set_style_text_color(gear_label, lv_color_hex(0xFF4444), 0);
    } else if (rs.throttle < -30) {
        lv_label_set_text(gear_label, "BRAKE");
        lv_obj_set_style_text_color(gear_label, lv_color_hex(0x44AAFF), 0);
    } else {
        lv_label_set_text(gear_label, "CRUISE");
        lv_obj_set_style_text_color(gear_label, lv_color_hex(0x88FF88), 0);
    }
}

/* ══════════════════════════════════════════════════════════════════════
 *  PUBLIC API
 * ════════════════════════════════════════════════════════════════════ */

void game_ui_set_joystick(const joystick_state_t *js) {
    (void)js; /* Joystick input now handled by C3 */
}

void game_ui_update_from_wire(const void *packet_void) {
    if (xSemaphoreTake(pkt_mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
        memcpy((void *)&pkt_buf, packet_void, sizeof(wire_packet_t));
        pkt_ready = true;
        xSemaphoreGive(pkt_mutex);
    }
}

void game_ui_restart(void) {
    /* C3 handles restart via button press */
}

/* ── Helper: create a styled button ─────────────────────────────────── */
static lv_obj_t *make_btn(lv_obj_t *parent, const char *text, lv_color_t bg, int w, int h) {
    lv_obj_t *btn = lv_btn_create(parent);
    lv_obj_set_size(btn, w, h);
    lv_obj_set_style_bg_color(btn, bg, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn, 10, 0);
    /* No gradient, no shadow – keep it fast and clean */
    lv_obj_set_style_shadow_width(btn, 0, 0);
    lv_obj_set_style_border_width(btn, 1, 0);
    lv_obj_set_style_border_color(btn, lv_color_hex(0x333333), 0);
    lv_obj_set_style_border_opa(btn, LV_OPA_60, 0);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(lbl, lv_color_white(), 0);
    lv_obj_center(lbl);
    return btn;
}

void game_ui_init(void) {
    ESP_LOGI(TAG, "game_ui_init START");

    memset(&rs, 0, sizeof(rs));
    rs.phase = PHASE_MENU;
    rs.prev_phase = PHASE_MENU;
    rs.menu_selection = 0;
    rs.go_selection = 0;
    rs.car_x = LANE_CX(NUM_LANES / 2);
    rs.crash_obs_lane = -1;

    pkt_mutex = xSemaphoreCreateMutex();
    assert(pkt_mutex);

    init_car_colors();
    init_obs_colors();
    precompute_road_templates(false);

    scr_main = lv_obj_create(NULL);
    lv_obj_remove_style_all(scr_main);
    lv_obj_set_size(scr_main, SCR_W, SCR_H);
    lv_obj_clear_flag(scr_main, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_opa(scr_main, LV_OPA_TRANSP, 0);
    lv_obj_add_event_cb(scr_main, scene_draw_event_cb, LV_EVENT_DRAW_MAIN_BEGIN, NULL);

    refill_grass(false);

    speed_label = lv_label_create(scr_main);
    lv_label_set_text(speed_label, "0 km/h");
    lv_obj_set_style_text_font(speed_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(speed_label, lv_color_white(), 0);
    lv_obj_set_style_bg_opa(speed_label, LV_OPA_60, 0);
    lv_obj_set_style_bg_color(speed_label, COL_HUD_BG, 0);
    lv_obj_set_style_radius(speed_label, 8, 0);
    lv_obj_set_style_pad_hor(speed_label, 14, 0);
    lv_obj_set_style_pad_ver(speed_label, 8, 0);
    lv_obj_align(speed_label, LV_ALIGN_TOP_RIGHT, -20, 15);

    score_label = lv_label_create(scr_main);
    lv_label_set_text(score_label, "Score: 0  |  0 m");
    lv_obj_set_style_text_font(score_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(score_label, lv_color_white(), 0);
    lv_obj_set_style_bg_opa(score_label, LV_OPA_60, 0);
    lv_obj_set_style_bg_color(score_label, COL_HUD_BG, 0);
    lv_obj_set_style_radius(score_label, 8, 0);
    lv_obj_set_style_pad_hor(score_label, 14, 0);
    lv_obj_set_style_pad_ver(score_label, 8, 0);
    lv_obj_align(score_label, LV_ALIGN_TOP_LEFT, 20, 15);

    gear_label = lv_label_create(scr_main);
    lv_label_set_text(gear_label, "CRUISE");
    lv_obj_set_style_text_font(gear_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(gear_label, lv_color_hex(0x88FF88), 0);
    lv_obj_set_style_bg_opa(gear_label, LV_OPA_60, 0);
    lv_obj_set_style_bg_color(gear_label, COL_HUD_BG, 0);
    lv_obj_set_style_radius(gear_label, 8, 0);
    lv_obj_set_style_pad_hor(gear_label, 14, 0);
    lv_obj_set_style_pad_ver(gear_label, 8, 0);
    lv_obj_align(gear_label, LV_ALIGN_TOP_MID, 0, 15);

    wifi_label = lv_label_create(scr_main);
    lv_label_set_text(wifi_label, "Controller: Disconnected");
    lv_obj_set_style_text_font(wifi_label, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(wifi_label, lv_color_hex(0xFF6666), 0);
    lv_obj_set_style_bg_opa(wifi_label, LV_OPA_60, 0);
    lv_obj_set_style_bg_color(wifi_label, COL_HUD_BG, 0);
    lv_obj_set_style_radius(wifi_label, 8, 0);
    lv_obj_set_style_pad_hor(wifi_label, 14, 0);
    lv_obj_set_style_pad_ver(wifi_label, 8, 0);
    lv_obj_align(wifi_label, LV_ALIGN_BOTTOM_LEFT, 20, -15);

    /* ══ MENU PANEL ═══════════════════════════════════════════════════ */
    menu_panel = lv_obj_create(scr_main);
    lv_obj_remove_style_all(menu_panel);
    lv_obj_set_size(menu_panel, 440, 420);
    lv_obj_align(menu_panel, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_bg_color(menu_panel, lv_color_hex(0x0A0A0A), 0);
    lv_obj_set_style_bg_opa(menu_panel, LV_OPA_90, 0);
    lv_obj_set_style_radius(menu_panel, 16, 0);
    lv_obj_set_style_border_width(menu_panel, 1, 0);
    lv_obj_set_style_border_color(menu_panel, lv_color_hex(0xD90429), 0);
    lv_obj_set_style_border_opa(menu_panel, LV_OPA_40, 0);
    lv_obj_set_style_shadow_width(menu_panel, 0, 0);  /* no shadow – faster */
    lv_obj_set_style_pad_all(menu_panel, 24, 0);
    lv_obj_clear_flag(menu_panel, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_flex_flow(menu_panel, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(menu_panel, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(menu_panel, 12, 0);

    menu_title = lv_label_create(menu_panel);
    lv_label_set_text(menu_title, "FREEWAY FRENZY");
    lv_obj_set_style_text_font(menu_title, &lv_font_montserrat_44, 0);
    lv_obj_set_style_text_color(menu_title, lv_color_hex(0xD90429), 0);
    lv_obj_set_style_text_letter_space(menu_title, 10, 0);

    menu_subtitle = lv_label_create(menu_panel);
    lv_label_set_text(menu_subtitle, "Extreme Driving");
    lv_obj_set_style_text_font(menu_subtitle, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(menu_subtitle, lv_color_hex(0x8ECAE6), 0);

    menu_highscore = lv_label_create(menu_panel);
    lv_label_set_text(menu_highscore, "");
    lv_obj_set_style_text_font(menu_highscore, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(menu_highscore, lv_color_hex(0xFFD700), 0);
    lv_obj_add_flag(menu_highscore, LV_OBJ_FLAG_HIDDEN);

    /* ── Car colour selector row ─────────────────────────────────────── */
    menu_color_row = lv_obj_create(menu_panel);
    lv_obj_remove_style_all(menu_color_row);
    lv_obj_set_size(menu_color_row, 320, 50);
    lv_obj_set_style_bg_color(menu_color_row, lv_color_hex(0x111111), 0);
    lv_obj_set_style_bg_opa(menu_color_row, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(menu_color_row, 12, 0);
    lv_obj_set_style_pad_hor(menu_color_row, 12, 0);
    lv_obj_clear_flag(menu_color_row, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_flex_flow(menu_color_row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(menu_color_row, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(menu_color_row, 10, 0);

    menu_color_arrow_l = lv_label_create(menu_color_row);
    lv_label_set_text(menu_color_arrow_l, LV_SYMBOL_LEFT);
    lv_obj_set_style_text_font(menu_color_arrow_l, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(menu_color_arrow_l, lv_color_hex(0x888888), 0);

    menu_color_swatch = lv_obj_create(menu_color_row);
    lv_obj_remove_style_all(menu_color_swatch);
    lv_obj_set_size(menu_color_swatch, 32, 32);
    lv_obj_set_style_bg_color(menu_color_swatch, car_colors[0].body, 0);
    lv_obj_set_style_bg_opa(menu_color_swatch, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(menu_color_swatch, 8, 0);
    lv_obj_set_style_border_width(menu_color_swatch, 2, 0);
    lv_obj_set_style_border_color(menu_color_swatch, lv_color_white(), 0);
    lv_obj_set_style_border_opa(menu_color_swatch, LV_OPA_40, 0);

    menu_color_name = lv_label_create(menu_color_row);
    lv_label_set_text(menu_color_name, car_colors[0].name);
    lv_obj_set_style_text_font(menu_color_name, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(menu_color_name, lv_color_white(), 0);
    lv_obj_set_flex_grow(menu_color_name, 1);

    menu_color_arrow_r = lv_label_create(menu_color_row);
    lv_label_set_text(menu_color_arrow_r, LV_SYMBOL_RIGHT);
    lv_obj_set_style_text_font(menu_color_arrow_r, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(menu_color_arrow_r, lv_color_hex(0x888888), 0);

    {
        lv_obj_t *hint = lv_label_create(menu_panel);
        lv_label_set_text(hint, "Steer to change colour");
        lv_obj_set_style_text_font(hint, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(hint, lv_color_hex(0x666688), 0);
    }

    menu_play_btn = make_btn(menu_panel, "Press joystick to PLAY", lv_color_hex(0xD90429), 320, 60);

    /* ══ GAME OVER PANEL ══════════════════════════════════════════════ */
    go_panel = lv_obj_create(scr_main);
    lv_obj_remove_style_all(go_panel);
    lv_obj_set_size(go_panel, 440, 380);
    lv_obj_align(go_panel, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_bg_color(go_panel, lv_color_hex(0x0A0A0A), 0);
    lv_obj_set_style_bg_opa(go_panel, LV_OPA_90, 0);
    lv_obj_set_style_radius(go_panel, 16, 0);
    lv_obj_set_style_border_width(go_panel, 1, 0);
    lv_obj_set_style_border_color(go_panel, lv_color_hex(0xFF4444), 0);
    lv_obj_set_style_border_opa(go_panel, LV_OPA_40, 0);
    lv_obj_set_style_shadow_width(go_panel, 0, 0);  /* no shadow – faster */
    lv_obj_set_style_pad_all(go_panel, 24, 0);
    lv_obj_clear_flag(go_panel, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_flex_flow(go_panel, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(go_panel, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(go_panel, 12, 0);
    lv_obj_add_flag(go_panel, LV_OBJ_FLAG_HIDDEN);

    go_title = lv_label_create(go_panel);
    lv_label_set_text(go_title, "CRASHED!");
    lv_obj_set_style_text_font(go_title, &lv_font_montserrat_44, 0);
    lv_obj_set_style_text_color(go_title, lv_color_hex(0xFF4444), 0);

    go_score_label = lv_label_create(go_panel);
    lv_label_set_text(go_score_label, "Score: 0");
    lv_obj_set_style_text_font(go_score_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(go_score_label, lv_color_white(), 0);

    go_high_label = lv_label_create(go_panel);
    lv_label_set_text(go_high_label, "Best: 0");
    lv_obj_set_style_text_font(go_high_label, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(go_high_label, lv_color_hex(0xFFD700), 0);

    go_distance_label = lv_label_create(go_panel);
    lv_label_set_text(go_distance_label, "Distance: 0 m");
    lv_obj_set_style_text_font(go_distance_label, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(go_distance_label, lv_color_hex(0xAAAAAA), 0);

    go_retry_btn = make_btn(go_panel, "Press joystick to RETRY", lv_color_hex(0xD90429), 320, 60);
    go_menu_btn = make_btn(go_panel, "", lv_color_hex(0x333355), 320, 60);
    lv_obj_add_flag(go_menu_btn, LV_OBJ_FLAG_HIDDEN); /* C3 handles restart */

    /* ── Load screen and start ────────────────────────────────────── */
    lv_scr_load(scr_main);

    switch_phase(PHASE_MENU);
    last_frame_us = esp_timer_get_time();
    game_timer = lv_timer_create(game_loop_cb, 16, NULL);  /* ~60 fps */

    ESP_LOGI(TAG, "Renderer initialised – waiting for C3 controller");
}

/****************************************************************************
 * Freeway Frenzy – S3 UART Receiver
 *
 * Receives world_packet_t from C3 controller at 460800 baud on UART2.
 * Thread-safe handoff to game_ui via game_ui_update_from_wire().
 ***************************************************************************/
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/uart.h"
#include "esp_log.h"

#include "game_ui.h"
#include "uart_joystick.h"

#define UART_NUM       UART_NUM_2
#define PIN_RX         44
#define PIN_TX         43
#define BUF_SIZE       512
#define BAUD_RATE      460800

#define MAX_WIRE_OBS   12

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
    } obs[MAX_WIRE_OBS];
    int8_t   steer;
    int8_t   throttle;
    uint8_t  btn;
    uint8_t  night_mode;
} world_packet_t;

static void uart_task(void *pvParameters)
{
    uint8_t byte;
    world_packet_t pkt;
    static const char *TAG = "uart_rx";

    ESP_LOGI(TAG, "S3 UART listener started. RX=%d, baud=%d", PIN_RX, BAUD_RATE);

    while (1) {
        /* Scan for sync byte */
        int err = uart_read_bytes(UART_NUM, &byte, 1, pdMS_TO_TICKS(10));
        if (err > 0 && byte == 0xA5) {
            pkt.sync = 0xA5;
            int len = uart_read_bytes(UART_NUM, (uint8_t *)&pkt + 1,
                                      sizeof(pkt) - 1, pdMS_TO_TICKS(15));
            if (len == sizeof(pkt) - 1) {
                game_ui_update_from_wire(&pkt);
            }
        }
    }
}

void uart_joystick_init(void)
{
    uart_config_t uart_config = {
        .baud_rate = BAUD_RATE,
        .data_bits = UART_DATA_8_BITS,
        .parity    = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };

    uart_driver_install(UART_NUM, BUF_SIZE * 2, 0, 0, NULL, 0);
    uart_param_config(UART_NUM, &uart_config);
    uart_set_pin(UART_NUM, PIN_TX, PIN_RX, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

    /* Pin UART to Core 0 so it doesn't fight LVGL on Core 1 */
    xTaskCreatePinnedToCore(uart_task, "uart_rx", 4096, NULL, 6, NULL, 0);
}

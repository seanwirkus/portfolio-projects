#include "esp_log.h"
#include "nvs_flash.h"
#include <stdint.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "i2c.h"
#include "io_extension.h"
#include "rgb_lcd_port.h"
#include "lvgl_port.h"
#include "game_ui.h"
#include "uart_joystick.h"

static const char *TAG = "test";

void app_main(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
    } else {
        ESP_ERROR_CHECK(err);
    }

    ESP_LOGI(TAG, "Init IO expander");
    DEV_I2C_Init();
    IO_EXTENSION_Init();

    ESP_LOGI(TAG, "Init LCD");
    esp_lcd_panel_handle_t panel = waveshare_esp32_s3_rgb_lcd_init();

    ESP_LOGI(TAG, "Backlight");
    wavesahre_rgb_lcd_bl_on();

    ESP_LOGI(TAG, "Init LVGL");
    ESP_ERROR_CHECK(lvgl_port_init(panel, NULL));

    ESP_LOGI(TAG, "Init game UI");
    if (lvgl_port_lock(-1)) {
        game_ui_init();
        lvgl_port_unlock();
    }

    ESP_LOGI(TAG, "Start UART renderer link");
    uart_joystick_init();

    ESP_LOGI(TAG, "Done");
    while (1) vTaskDelay(pdMS_TO_TICKS(1000));
}

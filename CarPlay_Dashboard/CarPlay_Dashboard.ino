#include "rgb_lcd_port.h"
#include "gui_paint.h"
#include "carplay_ultra.h"
#include <Arduino.h>

#define DASHBOARD_WIDTH  EXAMPLE_LCD_H_RES
#define DASHBOARD_HEIGHT EXAMPLE_LCD_V_RES

UBYTE *DashboardImage = NULL;
CarPlayUltra ultraDashboard;

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("CARPLAY ULTRA: boot");

  Serial.println("I2C init...");
  DEV_I2C_Init();
  delay(100);

  Serial.println("IO ext init...");
  IO_EXTENSION_Init();
  delay(100);

  Serial.println("LCD init...");
  waveshare_esp32_s3_rgb_lcd_init();
  delay(100);

  Serial.println("Backlight ON...");
  wavesahre_rgb_lcd_bl_on();
  delay(500);

  UDOUBLE Imagesize = DASHBOARD_WIDTH * DASHBOARD_HEIGHT * 2;
  Serial.printf("Alloc %lu bytes\n", (unsigned long)Imagesize);
  DashboardImage = (UBYTE *)malloc(Imagesize);
  if (!DashboardImage) {
    Serial.println("MALLOC FAILED!");
    while (1) delay(1000);
  }
  Serial.println("Alloc OK");

  Paint_NewImage(DashboardImage, DASHBOARD_WIDTH, DASHBOARD_HEIGHT, 0, WHITE);
  Paint_SetScale(65);
  Paint_SetRotate(ROTATE_0);

  // Solid red test — if you see red, the panel works
  for (int i = 0; i < (DASHBOARD_WIDTH * DASHBOARD_HEIGHT); i++) {
    ((uint16_t*)DashboardImage)[i] = 0xF800;
  }
  wavesahre_rgb_lcd_display(DashboardImage);
  Serial.println("RED displayed");
  delay(2000);

  // Solid green
  for (int i = 0; i < (DASHBOARD_WIDTH * DASHBOARD_HEIGHT); i++) {
    ((uint16_t*)DashboardImage)[i] = 0x07E0;
  }
  wavesahre_rgb_lcd_display(DashboardImage);
  Serial.println("GREEN displayed");
  delay(2000);

  // Solid white
  for (int i = 0; i < (DASHBOARD_WIDTH * DASHBOARD_HEIGHT); i++) {
    ((uint16_t*)DashboardImage)[i] = 0xFFFF;
  }
  wavesahre_rgb_lcd_display(DashboardImage);
  Serial.println("WHITE displayed");
  delay(2000);

  CarPlayUltra_Init(&ultraDashboard);
  Serial.println("Dashboard init done, entering loop");
}

void loop() {
  uint32_t now = millis();
  CarPlayUltra_Tick(&ultraDashboard, now);

  Paint_Clear(BLACK);
  CarPlayUltra_Render(&ultraDashboard);

  wavesahre_rgb_lcd_display(DashboardImage);
  delay(60);
}

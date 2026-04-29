/**
 * ESP32-CAM: MJPEG (Wi-Fi) or JPEG-over-serial (USB cable, no Wi-Fi).
 * Flash GPIO 4 — onboard LED / IO4 breakout.
 *
 * Wi-Fi build (default): browser UI + MJPEG.
 * Serial build: board uploads JPEG frames over USB-UART to the PC — see README + tools/view_serial.py
 */

#include <Arduino.h>
#include <esp_camera.h>
#include <esp_heap_caps.h>

#if !TRANSPORT_SERIAL
#include <WiFi.h>
#include <WebServer.h>
#include "secrets.h"
#endif

// Default Wi-Fi build acts as a camera portal/access point.
#ifndef WIFI_SOFTAP
#define WIFI_SOFTAP 1
#endif

// -----------------------------------------------------------------------------
// AI-Thinker ESP32-CAM pin map
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

/** JPEG framed packets begin with this (easy to sync on host). */
static const uint8_t kFrameMagic[] = {0xCA, 0xFE, 0x4A, 0x50};

#if !TRANSPORT_SERIAL
WebServer server(80);
#endif

/** Bright LED flash — onboard on many ESP32-CAM boards; also broken out as IO4. */
static constexpr int kFlashGpio = 4;

static void flashBegin() {
  pinMode(kFlashGpio, OUTPUT);
  digitalWrite(kFlashGpio, LOW);
}

static void flashSet(bool on) { digitalWrite(kFlashGpio, on ? HIGH : LOW); }

/** Tune serial vs Wi-Fi throughput. */
static bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

#if TRANSPORT_SERIAL
  if (psramFound()) {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 22;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_QQVGA;
    config.jpeg_quality = 24;
    config.fb_count = 1;
  }
#else
  if (psramFound()) {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 16;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_QQVGA;
    config.jpeg_quality = 20;
    config.fb_count = 1;
  }
#endif

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 0);
    s->set_saturation(s, 0);
  }
  return true;
}

static void emitJpegFrame(camera_fb_t *fb) {
  Serial.write(kFrameMagic, sizeof(kFrameMagic));
  uint32_t len = fb->len;
  Serial.write((uint8_t *)&len, sizeof(len));
  const uint8_t *buf = fb->buf;
  size_t left = fb->len;
  while (left > 0) {
    size_t chunk = left > 512 ? 512 : left;
    size_t w = Serial.write(buf, chunk);
    if (w == 0) {
      delay(1);
      continue;
    }
    buf += w;
    left -= w;
    yield();
  }
}

#if TRANSPORT_SERIAL

static bool streaming = false;
static String cmdLine;

static void serialPrintHelp() {
  Serial.println(F("Commands: STREAM_ON | STREAM_OFF | CAPTURE | FLASH_ON | FLASH_OFF | PULSE ms | HELP"));
}

static void handleSerialCmd(const String &line) {
  String u = line;
  u.trim();
  u.toUpperCase();
  if (u.length() == 0) return;

  if (u == "STREAM_ON") {
    streaming = true;
    return;
  }
  if (u == "STREAM_OFF" || u == "STOP") {
    streaming = false;
    return;
  }
  if (u == "CAPTURE") {
    flashSet(true);
    delay(40);
    camera_fb_t *fb = esp_camera_fb_get();
    flashSet(false);
    if (!fb) {
      Serial.println(F("ERR capture"));
      return;
    }
    emitJpegFrame(fb);
    esp_camera_fb_return(fb);
    return;
  }
  if (u == "FLASH_ON") {
    flashSet(true);
    Serial.println(F("OK"));
    return;
  }
  if (u == "FLASH_OFF") {
    flashSet(false);
    Serial.println(F("OK"));
    return;
  }
  if (u.startsWith("PULSE ")) {
    unsigned ms = u.substring(6).toInt();
    if (ms < 10) ms = 80;
    if (ms > 2000) ms = 2000;
    flashSet(true);
    delay(ms);
    flashSet(false);
    Serial.println(F("OK"));
    return;
  }
  if (u == "HELP" || u == "?") {
    serialPrintHelp();
    return;
  }
  Serial.println(F("ERR unknown (send HELP)"));
}

static void pollSerialCommands() {
  while (Serial.available()) {
    char c = static_cast<char>(Serial.read());
    if (c == '\r') continue;
    if (c == '\n') {
      handleSerialCmd(cmdLine);
      cmdLine = "";
    } else if (cmdLine.length() < 96) {
      cmdLine += c;
    }
  }
}

static void streamOneFrameIfNeeded() {
  if (!streaming) return;
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return;
  emitJpegFrame(fb);
  esp_camera_fb_return(fb);
}

#else

static void handleRoot() {
  const char html[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<title>ESP32-CAM</title>
<style>
body{font-family:system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:16px;}
h1{font-size:1.1rem;font-weight:600;}
.live{max-width:100%;border:1px solid #333;background:#000;}
.row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;}
button{padding:10px 14px;border:none;border-radius:8px;cursor:pointer;background:#2563eb;color:#fff;font-size:14px;}
button.secondary{background:#374151;}
small{display:block;color:#888;margin-top:8px;}
</style></head><body>
<h1>ESP32-CAM — live / flash</h1>
<img class="live" src="/stream" alt="live"/>
<div class="row">
<button type="button" onclick="location.href='/capture'">Still</button>
<button type="button" onclick="fetch('/flash/on',{method:'POST'})">Flash on</button>
<button type="button" class="secondary" onclick="fetch('/flash/off',{method:'POST'})">Flash off</button>
<button type="button" onclick="fetch('/flash/pulse?ms=120',{method:'POST'})">Pulse</button>
</div>
<small>MJPEG: /stream · Still: /capture · Status: /status · Flash GPIO 4</small>
</body></html>
)HTML";
  server.send_P(200, "text/html", html);
}

static void handleCapture() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "capture failed");
    return;
  }
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.setContentLength(fb->len);
  server.send(200, "image/jpeg", "");
  server.sendContent(reinterpret_cast<const char *>(fb->buf), fb->len);
  esp_camera_fb_return(fb);
}

static void handleStatus() {
  sensor_t *s = esp_camera_sensor_get();
  String body;
  body.reserve(192);
  body += "ok\n";
  body += "psram=";
  body += psramFound() ? "yes" : "no";
  body += "\nfree_heap=";
  body += String(ESP.getFreeHeap());
  body += "\nfree_psram=";
  body += String(ESP.getFreePsram());
  body += "\nsensor_pid=0x";
  body += s ? String(s->id.PID, HEX) : "none";
  body += "\n";
  server.send(200, "text/plain", body);
}

static void handleStream() {
  WiFiClient client = server.client();
  const char *boundary = "mjpeg";

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=" + String(boundary));
  client.println("Access-Control-Allow-Origin: *");
  client.println("Cache-Control: no-cache");
  client.println();

  while (client.connected()) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      delay(10);
      continue;
    }
    client.print("--");
    client.println(boundary);
    client.println("Content-Type: image/jpeg");
    client.print("Content-Length: ");
    client.println(fb->len);
    client.println();
    client.write(fb->buf, fb->len);
    client.println();
    esp_camera_fb_return(fb);
    delay(35);
  }
}

static void handleFlashOn() {
  flashSet(true);
  server.send(204);
}

static void handleFlashOff() {
  flashSet(false);
  server.send(204);
}

static void handleFlashPulse() {
  unsigned ms = server.arg("ms").toInt();
  if (ms < 10) ms = 80;
  if (ms > 2000) ms = 2000;
  flashSet(true);
  delay(ms);
  flashSet(false);
  server.send(204);
}

#endif

void setup() {
#if TRANSPORT_SERIAL
  Serial.begin(921600);
#else
  Serial.begin(115200);
  Serial.println();
#endif

  flashBegin();

  if (!initCamera()) {
    Serial.println(F("Halting: camera error."));
    while (true) delay(1000);
  }

#if TRANSPORT_SERIAL
  // USB serial: no banner on boot (binary frames only). Type HELP in a terminal if needed.
#else

#if WIFI_SOFTAP
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(WIFI_SSID, WIFI_PASS)) {
    Serial.println(F("SoftAP start failed."));
    while (true) delay(1000);
  }
  Serial.print(F("AP SSID: "));
  Serial.println(WIFI_SSID);
  Serial.print(F("AP IP: "));
  Serial.println(WiFi.softAPIP());
#else
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
#endif

  server.on("/", HTTP_GET, handleRoot);
  server.on("/capture", HTTP_GET, handleCapture);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/stream", HTTP_GET, handleStream);
  server.on("/flash/on", HTTP_POST, handleFlashOn);
  server.on("/flash/off", HTTP_POST, handleFlashOff);
  server.on("/flash/pulse", HTTP_POST, handleFlashPulse);

  server.begin();
  Serial.println(F("HTTP server (/, /stream, /capture, flash POST)"));
#endif
}

void loop() {
#if TRANSPORT_SERIAL
  pollSerialCommands();
  streamOneFrameIfNeeded();
  yield();
#else
  server.handleClient();
#endif
}

#ifndef __CARPLAY_ULTRA_H
#define __CARPLAY_ULTRA_H

#include "gui_paint.h"
#include "fonts.h"
#include "carplay_theme.h"
#include <stdint.h>
#include <stdbool.h>

// ============================================================================
// CarPlay Ultra — Full Instrument Cluster + Info Panel Dashboard
// ============================================================================

// --- Vehicle State ---
typedef struct {
    // Driving
    float speed;              // Current speed in mph (0-160)
    float targetSpeed;        // Target speed for smooth interpolation
    float rpm;                // Current RPM (0-8000)
    float targetRpm;          // Target RPM for smooth interpolation
    uint8_t gear;             // Current gear (0=P, 1-6=drive gears, 7=R, 8=N, 9=D)
    float fuelLevel;          // Fuel level 0.0-1.0
    float engineTemp;         // Engine temp in F
    float oilPressure;        // Oil pressure PSI

    // Navigation
    float navProgress;        // Route progress 0.0-1.0
    int16_t compassHeading;   // Heading degrees
    float remainingMiles;     // Remaining distance
    char navInstruction[48];  // "Turn left on Main St"
    char navDistance[12];     // "0.3 mi"
    char navETA[8];           // "12 min"
    char navArrival[8];       // "9:41"
    char currentStreet[24];   // "McAuley St"

    // Trip
    float tripMiles;          // Trip odometer
    float tripMPG;            // Trip fuel economy
    uint16_t tripMinutes;     // Trip duration minutes
    uint32_t totalMileage;    // Total odometer

    // Environment
    int8_t outsideTemp;       // Outside temp F
    uint8_t weatherCode;      // 0=clear, 1=cloudy, 2=rain, 3=snow
    uint8_t airQuality;       // AQI value

    // Media
    char musicTitle[32];      // "Riptide"
    char musicArtist[32];     // "Vance Joy"
    float musicProgress;      // 0.0-1.0
    char musicElapsed[8];     // "3:07"
    char musicRemaining[8];   // "-0:53"

    // Calendar
    char calDay[4];           // "Mon"
    uint8_t calDate;          // 6
    char calEvent1[32];       // "Design Sync"
    char calTime1[16];        // "10:00-11:00 AM"
    char calEvent2[32];       // "Weekly Goal Sync"
    char calTime2[16];        // "2:30-3:30 PM"

    // Home
    char homeStatus[24];      // "Garage Door Closed"

    // System
    uint8_t batteryLevel;     // Phone battery %
    uint8_t signalBars;       // 0-4
    bool wifiConnected;
    bool bluetoothConnected;

} CarPlayState;

// --- Dashboard Structure ---
typedef struct {
    CarPlayState state;
    CarPlayState displayState;  // Smoothed state for rendering
    bool initialized;
    uint32_t lastTickMs;
    uint32_t frameCount;
    float animPhase;            // General animation phase 0-2PI

    // Gauge animation state
    float displaySpeed;         // Smoothed display speed
    float displayRpm;           // Smoothed display RPM
    float needleAngle;          // Current needle angle (smoothed)
    float rpmNeedleAngle;       // RPM needle angle (smoothed)
    float sweepAngle;           // Animated sweep for startup

} CarPlayUltra;

// --- Core Functions ---
void CarPlayUltra_Init(CarPlayUltra* cp);
void CarPlayUltra_Tick(CarPlayUltra* cp, uint32_t nowMs);
void CarPlayUltra_Render(CarPlayUltra* cp);

// --- Cluster Drawing ---
void CarPlayUltra_DrawClusterBackground(CarPlayUltra* cp);
void CarPlayUltra_DrawSpeedometer(CarPlayUltra* cp);
void CarPlayUltra_DrawRPMGauge(CarPlayUltra* cp);
void CarPlayUltra_DrawGearIndicator(CarPlayUltra* cp);
void CarPlayUltra_DrawMapInset(CarPlayUltra* cp);
void CarPlayUltra_DrawBottomStrip(CarPlayUltra* cp);

// --- Panel Drawing ---
void CarPlayUltra_DrawPanelBackground(CarPlayUltra* cp);
void CarPlayUltra_DrawStatusBar(CarPlayUltra* cp);
void CarPlayUltra_DrawTripCard(CarPlayUltra* cp);
void CarPlayUltra_DrawCalendarCard(CarPlayUltra* cp);
void CarPlayUltra_DrawWeatherCard(CarPlayUltra* cp);
void CarPlayUltra_DrawMusicCard(CarPlayUltra* cp);
void CarPlayUltra_DrawNavCard(CarPlayUltra* cp);

// --- Utility Drawing ---
void CarPlayUltra_DrawArc(uint16_t cx, uint16_t cy, uint16_t rOuter, uint16_t rInner,
                          float startAngle, float endAngle, uint16_t color);
void CarPlayUltra_DrawArcSegment(uint16_t cx, uint16_t cy, uint16_t rOuter, uint16_t rInner,
                                 float startAngle, float endAngle, uint16_t color);
void CarPlayUltra_DrawTickMarks(uint16_t cx, uint16_t cy, uint16_t rOuter, uint16_t rInner,
                                float startAngle, float endAngle, int count,
                                uint16_t color, uint16_t majorColor, int majorEvery);
void CarPlayUltra_DrawNeedle(uint16_t cx, uint16_t cy, uint16_t length,
                             float angleDeg, uint16_t color, uint8_t thickness);
void CarPlayUltra_DrawFilledCircle(uint16_t cx, uint16_t cy, uint16_t r, uint16_t color);
void CarPlayUltra_DrawRoundedCard(uint16_t x, uint16_t y, uint16_t w, uint16_t h,
                                  uint16_t color, uint16_t borderColor);
void CarPlayUltra_DrawHGradientBar(uint16_t x, uint16_t y, uint16_t w, uint16_t h,
                                   uint16_t colorStart, uint16_t colorEnd, float fillPct);
void CarPlayUltra_DrawGlowDot(uint16_t cx, uint16_t cy, uint16_t r, uint16_t coreColor, uint16_t glowColor);
void CarPlayUltra_DrawDivider(uint16_t x, uint16_t y, uint16_t w, uint16_t color);

// --- Helper ---
uint16_t CarPlayUltra_BlendColor(uint16_t c1, uint16_t c2, float t);
float CarPlayUltra_Lerp(float a, float b, float t);

#endif /* __CARPLAY_ULTRA_H */

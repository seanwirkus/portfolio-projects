/****************************************************************************
 * uart_joystick.h – UART2 Joystick Receiver for ESP32-S3
 ***************************************************************************/
#pragma once

/**
 * @brief Initialize UART2 (on GPIO 15/16) and start the listener task.
 */
void uart_joystick_init(void);

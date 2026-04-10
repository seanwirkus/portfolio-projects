idf_component_register(SRCS "main.c" "game_ui.c" "uart_joystick.c"
                       INCLUDE_DIRS "."
                       PRIV_REQUIRES nvs_flash touch driver)

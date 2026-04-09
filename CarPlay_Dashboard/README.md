# Apple CarPlay Studio Dashboard for ESP32-S3

A complete automotive-grade instrument cluster dashboard with Apple CarPlay-inspired interface designed for ESP32-S3 with 1024x600 RGB LCD display.

## 🚗 Features

### **Dashboard Components**
- **Speedometer**: Real-time speed display with animated needle (0-200 km/h)
- **Tachometer**: RPM gauge with smooth animation (0-6000 RPM)
- **Fuel Gauge**: Digital fuel level indicator with percentage display
- **Temperature Gauge**: Engine temperature monitoring (70-110°C)
- **Navigation Display**: Turn-by-turn navigation with distance indicators
- **Live Map Simulation**: CarPlay-style map canvas with animated route progress
- **Media Controls**: Music player interface with play/pause controls
- **Climate Control**: Temperature and HVAC status display
- **Status Indicators**: Signal lights, warnings, and system status

### **Apple CarPlay Theme**
- **Dark Mode Interface**: Optimized for nighttime driving
- **Large, Readable Fonts**: Safety-focused typography
- **Smooth Animations**: Gauge needle animations and transitions
- **Fast Refresh Navigation Loop**: 100ms UI updates to keep map and telemetry responsive
- **Modern UI Elements**: Rounded corners, proper spacing
- **High Contrast**: Excellent visibility in various lighting conditions

### **Technical Features**
- **1024x600 Resolution**: Optimized for automotive displays
- **Real-time Updates**: 100ms refresh rate for smooth performance
- **Configurable Settings**: Easy customization through config file
- **Mock Data Simulation**: Built-in sensor simulation for testing
- **Comprehensive Debugging**: Serial monitoring and error reporting

## 📁 Project Structure

```
CarPlay_Dashboard/
├── CarPlay_Dashboard.ino      # Main dashboard application
├── CarPlay_Config.h           # Configuration settings
├── CarPlay_Utils.cpp          # Utility functions and animations
├── rgb_lcd_port.h             # LCD driver (from original project)
├── rgb_lcd_port.cpp           # LCD driver implementation
├── gui_paint.h                # Graphics drawing functions
├── gui_paint.cpp              # Graphics implementation
├── image.h                    # Image resources
├── image.cpp                  # Image data
├── i2c.h/i2c.cpp             # I2C communication
├── io_extension.h/io_extension.cpp  # IO expansion control
├── fonts.h + font*.cpp        # Font definitions
└── Debug.h                    # Debug utilities
```

## 🛠️ Hardware Requirements

### **ESP32-S3 Development Board**
- ESP32-S3 chip with sufficient GPIO pins
- Minimum 4MB Flash memory
- USB connectivity for programming

### **1024x600 RGB LCD Display**
- RGB interface (16-bit color depth recommended)
- Compatible timing parameters (configurable)
- I2C backlight control support
- Touch interface optional

### **Additional Components**
- I2C IO expansion chip (for backlight control)
- Proper power supply (5V recommended)
- Wiring harness for GPIO connections

## 📋 Installation & Setup

### **1. Arduino IDE Setup**
1. Install ESP32-S3 board support in Arduino IDE
2. Install required libraries:
   - TFT_eSPI (for display support)
   - WiFi (built-in)
   - FreeRTOS (built-in)

### **2. Hardware Connections**
```
ESP32-S3    →    LCD Display
GPIO 3      →    VSYNC
GPIO 46     →    HSYNC  
GPIO 5      →    DE (Data Enable)
GPIO 7      →    PCLK (Pixel Clock)
GPIO 14-40  →    RGB Data Lines (16-bit)
GPIO 8,9    →    I2C SDA, SCL (Backlight Control)
```

### **3. Configuration**
Edit `CarPlay_Config.h` to match your hardware:
- Display dimensions
- GPIO pin assignments
- Color preferences
- Gauge ranges
- Update intervals

### **4. Upload & Test**
1. Connect ESP32-S3 to computer via USB
2. Select correct board and port in Arduino IDE
3. Upload `CarPlay_Dashboard.ino`
4. Open Serial Monitor at 115200 baud
5. Verify initialization and display operation

## 🎨 Customization

### **Display Themes**
Modify colors in `CarPlay_Config.h`:
```cpp
#define COLOR_BLACK       0x0000
#define COLOR_WHITE       0xFFFF
#define COLOR_BLUE        0x1C7F
// ... add your custom colors
```

### **Gauge Ranges**
Adjust measurement ranges:
```cpp
#define SPEEDOMETER_MAX_SPEED      200     // km/h
#define TACHOMETER_MAX_RPM         6000    // RPM
#define TEMP_GAUGE_MIN             70      // Celsius
#define TEMP_GAUGE_MAX             110     // Celsius
```

### **Layout Customization**
Modify layout constants:
```cpp
#define TOP_BAR_HEIGHT       80
#define BOTTOM_BAR_HEIGHT    100
#define GAUGE_AREA_WIDTH     300
```

### **Animation Settings**
Control smooth animations:
```cpp
#define NEEDLE_ANIMATION_SPEED     5       // Lower = faster
#define GAUGE_UPDATE_DELAY         10      // milliseconds
```

## 🚀 Advanced Features

### **Real Sensor Integration**
Replace mock data with real sensors:
```cpp
// In updateCarData() function
currentSpeed = getSpeedFromSensor();
currentRPM = getRPMFromSensor();
fuelLevel = getFuelLevel();
engineTemp = getEngineTemperature();
```

### **Navigation Integration**
Add GPS and mapping:
```cpp
void updateNavigation() {
    // GPS coordinate processing
    // Turn-by-turn calculation
    // Distance estimation
}
```

### **Connectivity Features**
Add smartphone integration:
```cpp
void updatePhoneStatus() {
    // Bluetooth connectivity
    // Phone call status
    // Message notifications
}
```

## 🔧 Debugging & Troubleshooting

### **Serial Monitoring**
Monitor system status at 115200 baud:
```
Apple CarPlay Studio Dashboard Starting...
Initializing hardware...
Creating dashboard buffer...
Paint settings initialized
Dashboard initialization complete!
```

### **Common Issues**

**Display Not Working:**
- Check power connections
- Verify GPIO pin assignments
- Adjust timing parameters in LCD config

**Poor Performance:**
- Reduce animation speed
- Lower update frequency
- Check for memory leaks

**Color Issues:**
- Verify RGB color format (RGB565)
- Check backlight control
- Adjust contrast settings

### **Performance Optimization**
- Use double buffering for smooth animations
- Optimize drawing routines
- Implement efficient data structures
- Minimize memory allocations

## 📱 Mobile Integration

### **Bluetooth Connectivity**
Add smartphone features:
- Phone call display
- Text message notifications
- Contact list integration
- Calendar reminders

### **WiFi Features**
Connect to internet:
- Real-time traffic data
- Weather information
- Online radio streaming
- Software updates

### **Voice Control**
Integrate speech recognition:
- Hands-free operation
- Voice commands for climate
- Navigation by voice
- Media control

## 🎯 Future Enhancements

### **Planned Features**
- [ ] Touch screen support
- [ ] Multi-language support
- [ ] Theme customization
- [ ] Widget system
- [ ] Software update mechanism
- [ ] OBD-II integration
- [ ] Backup camera display
- [ ] Voice assistant integration

### **Hardware Upgrades**
- [ ] Higher resolution displays
- [ ] Multiple display support
- [ ] Ambient light sensing
- [ ] Gesture recognition
- [ ] Haptic feedback

## 📄 License

This project is open source and available under the MIT License. Feel free to modify and distribute according to your needs.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or report issues.

### **How to Contribute**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For support and questions:
- Check the troubleshooting section
- Review configuration settings
- Verify hardware connections
- Monitor serial output for errors

---

**Enjoy your Apple CarPlay Studio Dashboard! 🚗✨**
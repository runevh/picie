#include <Arduino.h>

#include "app/device_app.h"

DeviceApp deviceApp;

void setup() {
    deviceApp.setup();
}

void loop() {
    deviceApp.loop();
}

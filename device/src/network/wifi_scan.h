#pragma once
#include <ArduinoJson.h>

template <typename Networks>
JsonDocument scanWifi(Networks& wifi) {
    JsonDocument result;
    JsonArray networks = result.to<JsonArray>();
    const int count = wifi.scanNetworks();
    for (int i = 0; i < count; i++) {
        JsonObject network = networks.add<JsonObject>();
        network["SSID"] = wifi.SSID(i);
        network["SignalStrength"] = wifi.RSSI(i);
    }
    return result;
}

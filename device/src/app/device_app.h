#pragma once

#include <Arduino.h>
#include <ArduinoOTA.h>

#include "app_config.h"

class DeviceApp {
public:
    explicit DeviceApp(const AppConfig &config = kDefaultAppConfig);

    void setup();
    void loop();

private:
    void loadCredentials();
    bool hasWifiCredentials() const;
    bool ensureWifiConnection();
    bool ensureTcpConnection(bool blocking);
    void setupOta();
    void enterProvisioningMode();
    void registerMessageHandlers();
    void resetReconnectBackoff();
    void increaseReconnectBackoff();

    AppConfig config_;
    String wifiSsid_;
    String wifiPassword_;
    bool provisioningMode_ = false;
    unsigned long lastReconnectAttempt_ = 0;
    unsigned long currentReconnectDelay_;
    bool otaInitialized_ = false;
};

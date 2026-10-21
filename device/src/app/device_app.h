#pragma once

#include <Arduino.h>

#include "app_config.h"

class DeviceApp {
public:
    explicit DeviceApp(const AppConfig &config = kDefaultAppConfig);

    void setup();
    void loop();

private:
    void loadCredentials();
    void provisionIdentityOverSerial(bool force = false);
    bool hasWifiCredentials() const;
    bool ensureWifiConnection();
    bool ensureTcpConnection(bool blocking);
    void pollProvisioningCommand();
    void registerMessageHandlers();
    void resetReconnectBackoff();
    void increaseReconnectBackoff();

    AppConfig config_;
    String wifiSsid_;
    String wifiPassword_;
    String setupCommand_;
    unsigned long lastReconnectAttempt_ = 0;
    unsigned long currentReconnectDelay_;
    uint8_t tcpConnectionFailures_ = 0;
};

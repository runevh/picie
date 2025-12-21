#include "device_app.h"

#include <algorithm>

#include <ESP8266WiFi.h>

#include <display/display.h>
#include <display/display_updater.h>
#include <network/ap.h>
#include <network/network.h>
#include <storage/storage.h>

DeviceApp::DeviceApp(const AppConfig &config)
    : config_(config),
      currentReconnectDelay_(config.reconnect.initialDelayMs) {}

void DeviceApp::setup() {
    Serial.begin(115200);
    init_storage();

    loadCredentials();
    registerMessageHandlers();

    Serial.println("Initializing display...");
    display.init();

    if (!ensureWifiConnection()) {
        enterProvisioningMode();
        return;
    }

    if (ensureTcpConnection(true)) {
        resetReconnectBackoff();
    } else {
        increaseReconnectBackoff();
    }
}

void DeviceApp::loop() {
    if (provisioningMode_) {
        delay(100);
        return;
    }

    if (WiFi.status() == WL_CONNECTED && otaInitialized_) {
        ArduinoOTA.handle();
    }

    if (is_connected_to_tcp_server()) {
        processIncomingMessages();
        delay(config_.messagePollingDelayMs);
        return;
    }

    ensureWifiConnection();

    const unsigned long now = millis();
    if (now - lastReconnectAttempt_ < currentReconnectDelay_) {
        delay(50);
        return;
    }

    if (ensureTcpConnection(false)) {
        resetReconnectBackoff();
    } else {
        increaseReconnectBackoff();
    }

    lastReconnectAttempt_ = now;
}

void DeviceApp::loadCredentials() {
    wifiSsid_ = read_at_address(SSID_ADDR);
    wifiPassword_ = read_at_address(PASSW_ADDR);

    wifiSsid_.trim();
    wifiPassword_.trim();
}

bool DeviceApp::hasWifiCredentials() const {
    return !wifiSsid_.isEmpty() && !wifiPassword_.isEmpty();
}

bool DeviceApp::ensureWifiConnection() {
    if (WiFi.status() == WL_CONNECTED) {
        if (!otaInitialized_) {
            setupOta();
        }
        return true;
    }

    if (!hasWifiCredentials()) {
        Serial.println("WiFi credentials are missing.");
        return false;
    }

    Serial.println("Attempting to connect to WiFi...");
    if (!connect_to_wifi(wifiSsid_, wifiPassword_)) {
        return false;
    }

    setupOta();
    return true;
}

bool DeviceApp::ensureTcpConnection(bool blocking) {
    if (!ensureWifiConnection()) {
        return false;
    }

    if (is_connected_to_tcp_server()) {
        return true;
    }

    if (!blocking) {
        return connect_to_tcp_server(config_.server.host, config_.server.port);
    }

    while (!connect_to_tcp_server(config_.server.host, config_.server.port)) {
        delay(config_.reconnect.initialDelayMs);
        if (!ensureWifiConnection()) {
            return false;
        }
    }

    return true;
}

void DeviceApp::enterProvisioningMode() {
    if (provisioningMode_) {
        return;
    }

    provisioningMode_ = true;
    Serial.println("Starting provisioning access point...");
    startAP();
}

void DeviceApp::registerMessageHandlers() {
    register_handler(0x20, &handle_incoming_image);
}

void DeviceApp::setupOta() {
    if (otaInitialized_) {
        return;
    }

    ArduinoOTA.onStart([]() {
        String type = ArduinoOTA.getCommand() == U_FLASH ? "sketch" : "filesystem";
        Serial.println("OTA Start updating " + type);
    });

    ArduinoOTA.onEnd([]() {
        Serial.println("OTA End");
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("OTA Progress: %u%%\r", (progress / (total / 100)));
    });

    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("OTA Error[%u]: ", error);
        if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
        else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
        else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
        else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
        else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });

    ArduinoOTA.begin();
    otaInitialized_ = true;
    Serial.println("OTA ready");
}

void DeviceApp::resetReconnectBackoff() {
    currentReconnectDelay_ = config_.reconnect.initialDelayMs;
}

void DeviceApp::increaseReconnectBackoff() {
    currentReconnectDelay_ = std::min(
        static_cast<unsigned long>(currentReconnectDelay_ * config_.reconnect.backoffFactor),
        config_.reconnect.maxDelayMs);
}

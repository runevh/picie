#include "device_app.h"

#include <algorithm>

#include <ESP8266WiFi.h>
#include <ArduinoJson.h>

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

    provisionIdentityOverSerial();

    configure_client(config_.useSecureClient, config_.rootCaCert);

    loadCredentials();
    registerMessageHandlers();

    Serial.println("Initializing display...");
    display.init();

    if (!ensureWifiConnection()) {
        enterProvisioningMode();
        return;
    }

    // Ensure system time is set before TLS connections.
    sync_time();

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

void DeviceApp::provisionIdentityOverSerial(bool force) {
    // Only run when the device hasn't been provisioned yet, unless forced.
    String uuid = read_at_address(UUID_ADDR);
    String key = read_at_address(KEY_ADDR);

    if (!force && !uuid.isEmpty() && !key.isEmpty()) {
        return;
    }

    Serial.println();
    Serial.println("Provisioning identity over serial.");
    Serial.println("Send a single line of JSON: {\"uuid\":\"...\",\"key\":\"...\"}");
    Serial.println(force ? "Retrying after connection failures. Waiting up to 60 seconds..." : "Waiting up to 60 seconds...");

    const unsigned long timeoutMs = 60000;
    const unsigned long start = millis();
    while ((millis() - start) < timeoutMs) {
        if (Serial.available()) {
            String line = Serial.readStringUntil('\n');
            line.trim();
            if (line.length() == 0) {
                continue;
            }

            StaticJsonDocument<256> doc;
            DeserializationError err = deserializeJson(doc, line);
            if (err) {
                Serial.println("Invalid JSON. Please resend.");
                continue;
            }

            const char *incomingUuid = doc["uuid"];
            const char *incomingKey = doc["key"];

            if (!incomingUuid || !incomingKey || strlen(incomingUuid) == 0 || strlen(incomingKey) == 0) {
                Serial.println("Both 'uuid' and 'key' fields are required. Please resend.");
                continue;
            }

            write_at_address(UUID_ADDR, incomingUuid);
            write_at_address(KEY_ADDR, incomingKey);
            Serial.println("UUID and key stored. Rebooting...");
            ESP.restart();
            return; // In case restart is delayed
        }
        delay(10);
    }

    Serial.println("Provisioning timeout. Continuing without identity.");
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
        bool ok = connect_to_tcp_server(config_.server.host, config_.server.port);
        if (ok) {
            tcpConnectionFailures_ = 0;
            return true;
        }

        tcpConnectionFailures_++;
        if (tcpConnectionFailures_ >= 5) {
            Serial.println("TCP connection failed 5 times. Re-entering serial provisioning.");
            provisionIdentityOverSerial(true);
            tcpConnectionFailures_ = 0; // avoid repeated immediate prompts
        }
        return false;
    }

    while (!connect_to_tcp_server(config_.server.host, config_.server.port)) {
        tcpConnectionFailures_++;
        if (tcpConnectionFailures_ >= 5) {
            Serial.println("TCP connection failed 5 times (blocking). Re-entering serial provisioning.");
            provisionIdentityOverSerial(true);
            tcpConnectionFailures_ = 0;
        }
        delay(config_.reconnect.initialDelayMs);
        if (!ensureWifiConnection()) {
            return false;
        }
    }
    tcpConnectionFailures_ = 0;

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
    // Respond to server heartbeat ping (0x01) with pong (0x02).
    register_handler(0x01, [](const uint8_t*, size_t) {
        send_message(static_cast<uint8_t>(0x02), nullptr, 0);
    });
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

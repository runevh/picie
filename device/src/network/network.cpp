#include "network.h"
#include "trusted_connection.h"
#include <storage/storage.h>
#include <ArduinoJson.h>
#include <base64.h>
#include <cstring>
#include <WiFiClientSecureBearSSL.h>

WiFiClientSecure secureClient;
Client *client = &secureClient;
TrustedConnection<WiFiClientSecure, BearSSL::X509List> trustedConnection(secureClient);

// Built-in handlers: keep the device responsive to server health checks.
static void handle_ping(const uint8_t *, size_t) {
    // 0x01 = ping, reply with pong (0x02)
    send_message(static_cast<uint8_t>(0x02), nullptr, 0);
}

bool connect_to_wifi(String ssid, String password)
{
    Serial.print("Connecting to wifi...");
    WiFi.begin(ssid.c_str(), password.c_str());

    int retries = 0;

    while (WiFi.status() != WL_CONNECTED && retries < 20)
    {
        delay(500);
        Serial.print(".");
        retries++;
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("Connected successfuly to WiFi!");
        return true;
    }
    else
    {
        Serial.println("Failed to connect to WiFi!");
        return false;
    }
}

void configure_client(bool useSecureClient, const char *rootCaCert)
{
    if (!trustedConnection.configure(useSecureClient, rootCaCert)) {
        Serial.println("Server connection disabled: a valid TLS trust certificate is required.");
    }
}

bool connect_to_tcp_server(String host, int16_t port)
{
    Serial.println("Connecting to TLS server...");
    secureClient.setBufferSizes(512, 512);
    return trustedConnection.connect(host.c_str(), port, []() {
        // Credentials are read and sent only after TLS verification succeeds.
        String uuid = read_at_address(UUID_ADDR);
        String secret = read_at_address(KEY_ADDR);
        if (!send_message(uuid + secret)) return false;

        unsigned long startTime = millis();
        while (!client->available() && millis() - startTime < 2000) {
            delay(10);
        }
        return client->available() && client->read() == 0x10;
    });
}

bool sync_time()
{
    Serial.println("Syncing time via NTP...");
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    time_t now = time(nullptr);
    int retries = 0;
    while (now < 24 * 3600 && retries < 30) { // wait until time is set
        delay(200);
        now = time(nullptr);
        retries++;
    }
    if (now < 24 * 3600) {
        Serial.println("Time sync failed");
        return false;
    }
    Serial.printf("Time synced: %lld\n", static_cast<long long>(now));
    return true;
}

bool is_connected_to_tcp_server()
{
    return client && client->connected();
}

bool send_message(const uint8_t code, const uint8_t *data, size_t len)
{
    uint8_t *buffer = new uint8_t[len + 1];
    buffer[0] = code;
    memcpy(buffer + 1, data, len);

    size_t sent = client->write(buffer, len + 1);

    delete[] buffer;
    return (sent == len + 1);
}

bool send_message(String string)
{
    size_t sent = client->println(string);
    return (sent > 0);
}

MessageHandler handlers[256] = { nullptr };

// Ensure builtin handlers are registered once.
static void ensure_default_handlers() {
    static bool initialized = false;
    if (initialized) return;
    handlers[0x01] = handle_ping;
    initialized = true;
}

void register_handler(uint8_t messageCode, MessageHandler handler) {
    ensure_default_handlers();
    handlers[messageCode] = handler;
}

bool send_status(DeviceStatus status) {
    Serial.println("Sending status");
    return send_message(static_cast<uint8_t>(status), nullptr, 0);
}

void processIncomingMessages() {
    ensure_default_handlers();
    while (client->available() > 0) {
        uint8_t messageCode = client->read();

        if (handlers[messageCode] != nullptr) {
            handlers[messageCode](&messageCode, 1);
        } else {
            Serial.printf("No handler for message 0x%02X\n", messageCode);
        }
    }
}

bool wait_for_incoming_data(size_t size, unsigned long timeoutMs) {
    unsigned long start = millis();
    while ((millis() - start) < timeoutMs) {
        if (static_cast<size_t>(client->available()) >= size) {
            return true;
        }
        delay(10);
    }
    return false;
}

size_t read_buffer(uint8_t* buffer, size_t max_len) {
    size_t bytesRead = 0;

    while (bytesRead < max_len) {
        if (client->available() <= 0) {
            continue;
        }
        
        int byte = client->read();
        if (byte == -1) break;
        buffer[bytesRead++] = (uint8_t)byte;
    }

    return bytesRead;
}

void read_and_process_bytes(size_t n, void (*handler)(uint8_t byte)) {
    size_t count = 0;
    while (client->available() > 0 && count < n) {
        uint8_t byte = client->read();
        handler(byte);
        count++;
    }
}


bool wait_and_read_bytes(size_t size, unsigned long timeoutMs, void (*handler)(uint8_t)) {
    unsigned long start = millis();
    size_t bytesRead = 0;

    while (bytesRead < size && (millis() - start) < timeoutMs) {
        while (client->available() > 0 && bytesRead < size) {
            uint8_t byte = client->read();
            handler(byte);
            bytesRead++;
            // Reset timeout timer on every successful byte read to allow for slow streams
            start = millis();
        }
        delay(5); // small delay to avoid busy wait
    }

    return (bytesRead == size);
}

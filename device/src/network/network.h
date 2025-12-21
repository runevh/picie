#pragma once

#include <Arduino.h>
#include <ESP8266WiFi.h>

typedef void (*MessageHandler)(const uint8_t *data, size_t len);

enum DeviceStatus : uint8_t {
    STATUS_IDLE = 0x40,
    STATUS_UPDATING_IMAGE = 0x41,
    STATUS_PAIRING = 0x42,
    STATUS_UPDATING_FRAME = 0x43,
    STATUS_ERROR = 0x4F
};

bool connect_to_wifi(String ssid, String password);
bool connect_to_tcp_server(String host, int16_t port);
bool is_connected_to_tcp_server();
bool send_message(const uint8_t code, const uint8_t *data, size_t len);
bool send_message(String string);
bool send_status(DeviceStatus status);
void register_handler(uint8_t messageCode, MessageHandler handler);
void processIncomingMessages();
bool wait_for_incoming_data(size_t size, unsigned long timeoutMs = 30000);
size_t read_buffer(uint8_t* buffer, size_t max_len);
void read_and_process_bytes(size_t n, void (*handler)(uint8_t byte));
bool wait_and_read_bytes(size_t size, unsigned long timeoutMs, void (*handler)(uint8_t));

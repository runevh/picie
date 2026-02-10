#pragma once

#include <Arduino.h>

struct ServerEndpoint {
    const char *host;
    int16_t port;
};

struct ReconnectPolicy {
    unsigned long initialDelayMs;
    unsigned long maxDelayMs;
    float backoffFactor;
};

struct AppConfig {
    ServerEndpoint server;
    ReconnectPolicy reconnect;
    unsigned long messagePollingDelayMs;
    bool useSecureClient;
    const char *rootCaCert; // PEM-encoded root certificate used in secure mode
};

extern const AppConfig kDefaultAppConfig;

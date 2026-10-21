#include <network/ap.h>
#include <network/wifi_scan.h>
#include <network/provisioning_session.h>
#include <page_html.h>
#include <storage/storage.h>
extern "C" {
#include <osapi.h>
}

namespace {
DNSServer dnsServer;
ESP8266WebServer webServer(80);
ProvisioningSession session;

String randomSecret() {
    unsigned char bytes[16];
    if (os_get_random(bytes, sizeof(bytes)) != 0) return "";
    const char *hex = "0123456789abcdef";
    String result;
    for (auto byte : bytes) { result += hex[byte >> 4]; result += hex[byte & 15]; }
    return result;
}

bool authorized() {
    const String token = webServer.header("X-Setup-Code");
    if (session.authorized(millis(), std::string(token.c_str(), token.length()))) return true;
    webServer.send(403, "text/plain", "Setup code is incorrect or expired. Start setup over USB again.");
    return false;
}

void showPage() {
    if (!session.active(millis())) { webServer.send(403); return; }
    webServer.sendHeader("Cache-Control", "no-store");
    webServer.sendHeader("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'");
    webServer.send(200, "text/html", reinterpret_cast<const char*>(src_static_page_html), src_static_page_html_len);
}

void searchForWifi() {
    if (!authorized()) return;
    JsonDocument networks = scanWifi(WiFi);
    if (networks.overflowed()) { webServer.send(503, "application/json", "{}"); return; }
    String result;
    serializeJson(networks, result);
    webServer.send(200, "application/json", result);
}

void setWifiCredentials() {
    const String ssid = webServer.arg("ssid"), password = webServer.arg("password");
    const String token = webServer.header("X-Setup-Code");
    const int status = session.submit(millis(), std::string(token.c_str(), token.length()),
        std::string(ssid.c_str(), ssid.length()), std::string(password.c_str(), password.length()), [&]() {
            return write_wifi_credentials(ssid, password);
        });
    webServer.send(status, "text/plain", status == 200 ? "Settings saved" :
        status == 403 ? "Setup code is incorrect or expired. Start setup over USB again." :
        status == 400 ? "Use a network name of 1–32 bytes and a password of 8–63 bytes." : "Could not save settings. Try again.");
    if (status == 200) { delay(200); ESP.restart(); }
}
}

void startAP() {
    WiFi.persistent(false);
    WiFi.mode(WIFI_AP); // The setup server is never exposed on the home network.
    const String password = randomSecret(), token = randomSecret();
    const String name = "picie-setup-" + String(ESP.getChipId(), HEX);
    if (password.length() != 32 || token.length() != 32 || !WiFi.softAP(name.c_str(), password.c_str(), 1, false, 1)) {
        WiFi.softAPdisconnect(true);
        WiFi.mode(WIFI_STA);
        Serial.println("Could not start protected setup. Try WIFI_SETUP again.");
        return;
    }
    session.begin(millis(), token.c_str());
    Serial.println("Wi-Fi setup is available for five minutes.");
    Serial.println("Network: " + name);
    Serial.println("Hotspot password: " + password);
    Serial.println("Setup code: " + token);
    Serial.println("Open http://192.168.4.1 and enter the setup code.");
    webServer.collectHeaders("X-Setup-Code");
    webServer.onNotFound(showPage);
    webServer.on("/searchWifi", HTTP_GET, searchForWifi);
    webServer.on("/setWifiCredentials", HTTP_POST, setWifiCredentials);
    dnsServer.start(53, "*", WiFi.softAPIP());
    webServer.begin();
    while (session.active(millis())) {
        dnsServer.processNextRequest();
        webServer.handleClient();
        delay(1);
    }
    session.end();
    webServer.stop();
    dnsServer.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    Serial.println("Setup closed. Send WIFI_SETUP over USB to start a new session.");
}

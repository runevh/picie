#include <network/ap.h>
#include <network/wifi_scan.h>
#include <page_html.h>
#include <storage/storage.h>

const char *ssid = "live-picture";
const char *password = "";

DNSServer dnsServer;
ESP8266WebServer webServer(80);

bool connect = false;

void showPage() {
    webServer.send(200, "text/html", (const char*)src_static_page_html);
}

void searchForWifi() {
    JsonDocument networks = scanWifi(WiFi);
    if (networks.overflowed()) {
        webServer.send(503, "application/json", "{\"error\":\"Wi-Fi scan unavailable\"}");
        return;
    }
    String result;
    serializeJson(networks, result);

    webServer.send(200, "application/json", result);
}

void setWifiCredentials() {
    String ssid = webServer.arg("ssid");
    String pass = webServer.arg("password");

    if (ssid.length() > 0 && pass.length() > 0) {
        write_at_address(SSID_ADDR, ssid);
        write_at_address(PASSW_ADDR, pass);
    }

    webServer.send(200);

    ESP.restart();
}

void checkForRequests() 
{
    while (!connect) {
        dnsServer.processNextRequest();
        webServer.handleClient();
    }
}

void startAP()
{
    delay(3000);
    searchForWifi();
    WiFi.softAP(ssid, password);
    dnsServer.start(53, "*", WiFi.softAPIP()); //Redirect all domains to own AP IP
    webServer.onNotFound(showPage);
    webServer.on("/searchWifi", HTTP_GET, searchForWifi);
    webServer.on("/setWifiCredentials", HTTP_POST, setWifiCredentials);

    webServer.begin();

    checkForRequests();
}
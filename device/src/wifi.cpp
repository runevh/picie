#include "wifi.h"

bool connectToWifi(String ssid, String password)
{
    Serial.println(ssid);
    Serial.println(password);
    Serial.print("Connecting to wifi...");
    WiFi.begin(ssid.c_str(), password.c_str());

    int retries = 0;

    while (WiFi.status() != WL_CONNECTED && retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        return true;
    } else {
        return false;
    }
}

bool connectToSocket(String url) {

}
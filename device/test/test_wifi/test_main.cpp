#include <unity.h>
#include <network/wifi_scan.h>
#include <string>
#include <vector>

struct Networks {
    std::vector<std::string> names;
    int scanNetworks() { return names.size(); }
    std::string SSID(int i) { return names[i]; }
    int RSSI(int i) { return -40 - i; }
};
void setUp() {}
void tearDown() {}

void round_trip_network_names() {
    Networks wifi{{"Home", "a\"quote", "back\\slash", "line\n\r\t\x01", u8"Café 家", "<img src=x onerror=alert(1)>", ""}};
    JsonDocument result = scanWifi(wifi);
    std::string json;
    serializeJson(result, json);
    JsonDocument decoded;
    TEST_ASSERT_FALSE(deserializeJson(decoded, json));
    TEST_ASSERT_EQUAL(wifi.names.size(), decoded.size());
    for (size_t i = 0; i < wifi.names.size(); i++) {
        TEST_ASSERT_EQUAL_STRING(wifi.names[i].c_str(), decoded[i]["SSID"].as<const char*>());
        TEST_ASSERT_EQUAL(-40 - i, decoded[i]["SignalStrength"].as<int>());
    }
}
void empty_scan_is_an_array() {
    Networks wifi;
    std::string json;
    serializeJson(scanWifi(wifi), json);
    TEST_ASSERT_EQUAL_STRING("[]", json.c_str());
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(round_trip_network_names);
    RUN_TEST(empty_scan_is_an_array);
    return UNITY_END();
}

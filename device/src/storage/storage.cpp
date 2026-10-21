#include "storage.h"

void init_storage()
{
    EEPROM.begin(512);
}

String read_at_address(int addr)
{
    String s = "";
    for (size_t i = 0; i < 64; i++) {
        char c = EEPROM.read(addr + i);
        if(c == 0) break;
        s += c;
    }

    return s;
}

void write_at_address(int addr, const String &s)
{
    size_t len = s.length();
    if (len > 63) len = 63; // max 63 chars + 1 null byte

    for (size_t i = 0; i < len; i++) {
        EEPROM.write(addr + i, s[i]);
    }

    EEPROM.write(addr + len, 0);
    EEPROM.commit();
}

bool write_wifi_credentials(const String &ssid, const String &password) {
    if (ssid.length() == 0 || ssid.length() > 32 || password.length() < 8 || password.length() > 63) return false;
    uint8_t previous[128];
    for (size_t i = 0; i < 128; ++i) previous[i] = EEPROM.read(i);
    for (size_t i = 0; i < 64; ++i) {
        EEPROM.write(SSID_ADDR + i, i < ssid.length() ? ssid[i] : 0);
        EEPROM.write(PASSW_ADDR + i, i < password.length() ? password[i] : 0);
    }
    if (EEPROM.commit()) return true;
    for (size_t i = 0; i < 128; ++i) EEPROM.write(i, previous[i]);
    return false;
}

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
    for (size_t i = 0; i < s.length() && i < 64; i++) {
        Serial.println(s[i]);
        EEPROM.write(addr + i, s[i]);
    }

    size_t lastIndex = 63;
    if (lastIndex > s.length()) {
        lastIndex = s.length();
    }

    EEPROM.write(addr + lastIndex, 0);
    EEPROM.commit();
}
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
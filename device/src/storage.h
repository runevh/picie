#include <EEPROM.h>
#include <Arduino.h>

const int SSID_ADDR = 0; // SSID is mx 32 bytes
const int PASSW_ADDR = 64;

void init_storage();

String read_at_address(int addr);

void write_at_address(int addr, const String &s);
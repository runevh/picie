#include <Arduino.h>
#include <ap.h>
#include <storage.h>
#include <wifi.h>
#include <display.h>
#define key "2ZLkQpC3Fc"

#include <epd/imagedata.h>

#define PIN_CS   15  // D8
#define PIN_DC   0   // D3
#define PIN_RST  2   // D4
#define PIN_BUSY 4   // D2
#define PIN_MOSI 13  // D7 (Required for SPI)
#define PIN_CLK  14  // D5 (Required for SPI)

Display display;

void test_image() {
  Serial.begin(115200);

  Serial.println("Initializing display...");
  
  display.init();
  display.clear();
  Serial.println("Screen cleared, drawing image...");

  display.startImageTransfer();

  display.sendImageData(gImage_5in65f, 0, 0, 192, 143);
  display.sendImageData(gImage_5in65f, 0, 143, 192, 143);
  display.refresh();

  Serial.println("Done!");

  display.sleep();
}

void setup()
{
  Serial.begin(115200);
  init_storage();

  String ssid = read_at_address(SSID_ADDR);
  String pass = read_at_address(PASSW_ADDR);

  bool connected = connectToWifi(ssid, pass);

  if (!connected)
  {
    startAP();
  }

  Serial.println("\nConnected to WiFi!");
}

void loop()
{
}

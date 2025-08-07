#include <Arduino.h>
#include <network/ap.h>
#include <storage/storage.h>
#include <network/network.h>
#include <display/display_updater.h>

#include <epd/imagedata.h> 

#define PIN_CS   15  // D8
#define PIN_DC   0   // D3
#define PIN_RST  2   // D4
#define PIN_BUSY 4   // D2
#define PIN_MOSI 13  // D7 (Required for SPI)
#define PIN_CLK  14  // D5 (Required for SPI)

// 693887
void setu() {
  Serial.begin(115200);

  Serial.println("Initializing display...");
  
  display.init();
  display.clear();
  Serial.println("Screen cleared, drawing image...");

  display.startImageTransfer();

  for(int i = 0; i < 1; i++) {
    display.sendImageData(gImage_5in65f, 0, 0, 600, 100);
  }
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

  register_handler(0x20, &handle_incoming_image);

  Serial.println("Initializing display...");
  
  display.init();

  if (!connect_to_wifi(ssid, pass))
  {
    startAP();
    return;
  }

  while(!connect_to_tcp_server("192.168.1.38", 7735)) {
    delay(1000);
  }
}

void loop()
{
  //TODO: Add a check for WiFi connection
  if (is_connected_to_tcp_server()) {
    processIncomingMessages();
    delay(10);
  } else {
    while(!connect_to_tcp_server("192.168.1.38", 7735)) {
      delay(1000);
      //TODO: Make loop increasing wait (exponential)
    }
  }
}

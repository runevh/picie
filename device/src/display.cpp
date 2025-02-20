#include "display.h"
#include <SPI.h>
#include <pgmspace.h>

// https://github.com/waveshareteam/e-Paper/tree/master/Arduino/epd5in65f

Display::Display()
{
}

void Display::init()
{
    pinMode(CS_PIN, OUTPUT);
    pinMode(RST_PIN, OUTPUT);
    pinMode(DC_PIN, OUTPUT);
    pinMode(BUSY_PIN, INPUT);

    SPI.begin();
    SPI.beginTransaction(SPISettings(2000000, MSBFIRST, SPI_MODE0));

    reset();

    waitForBusyHigh(); // Wait to be ready

    sendCommand(0x00);
    sendData(0xEF);
    sendData(0x08);

    sendCommand(0x01);
    sendData(0x37);
    sendData(0x00);
    sendData(0x23);
    sendData(0x23);
    sendCommand(0x03);
    sendData(0x00);
    sendCommand(0x06);
    sendData(0xC7);
    sendData(0xC7);
    sendData(0x1D);
    sendCommand(0x30);
    sendData(0x3C);
    sendCommand(0x41);
    sendData(0x00);
    sendCommand(0x50);
    sendData(0x37);
    sendCommand(0x60);
    sendData(0x22);
    sendCommand(0x61);
    sendData(0x02);
    sendData(0x58);
    sendData(0x01);
    sendData(0xC0);
    sendCommand(0xE3);
    sendData(0xAA);

    delay(100);
    sendCommand(0x50);
    sendData(0x37);
}

void Display::reset()
{
    digitalWrite(RST_PIN, LOW);
    delay(1);
    digitalWrite(RST_PIN, HIGH);
    delay(200);
}

void Display::sendCommand(unsigned char command)
{
    digitalWrite(DC_PIN, LOW);
    spiTransfer(command);
}

void Display::sendData(unsigned char data)
{
    digitalWrite(DC_PIN, HIGH);
    spiTransfer(data);
}

void Display::waitForBusyHigh()
{
    while (!(digitalRead(BUSY_PIN)))
    {
        ESP.wdtFeed(); // Prevent watchdog timer from interrupting
    }
}

void Display::waitForBusyLow()
{
    while (digitalRead(BUSY_PIN))
    {
        ESP.wdtFeed(); // Prevent watchdog timer from interrupting, best would be to run on seperate core but ESP8266 only has 1
    }
}

void Display::clear(unsigned char color)
{
    sendCommand(0x61); // Set Resolution setting
    sendData(0x02);
    sendData(0x58);
    sendData(0x01);
    sendData(0xC0);
    sendCommand(0x10);

    for (size_t i = 0; i < DISPLAY_WIDTH / 2; i++)
    {
        for (size_t j = 0; j < DISPLAY_HEIGHT; j++)
        {
            sendData((color << 4) | color);
        }
    }

    sendCommand(0x04);
    waitForBusyHigh();
    sendCommand(0x12);
    waitForBusyHigh();
    sendCommand(0x02);
    waitForBusyLow();
    delay(500);
}

void Display::startImageTransfer()
{
    sendCommand(0x10);
}

void Display::sendImageData(const unsigned char *image, unsigned int x, unsigned int y, unsigned int width, unsigned int height)
{
    for (unsigned long i = y; i < height + y; i++)
    {
        for (unsigned long j = 0; j < DISPLAY_WIDTH / 2; j++)
        {
            if (i < height + y && i >= y && j < (width + x) / 2 && j >= x / 2)
            {
                sendData(pgm_read_byte(&image[(j - x / 2) + (width / 2 * (i - y))]));
            }
            else
            {
                sendData(0x11); // Set the rest to white
            }
        }
    }
}

void Display::sleep()
{
    delay(100);
    sendCommand(0x07);
    sendData(0xA5);
    delay(100);
	digitalWrite(RST_PIN, 0);
}

void Display::refresh()
{
    sendCommand(0x04);
    waitForBusyHigh();

    sendCommand(0x12);
    waitForBusyHigh();
    
    sendCommand(0x02);
    waitForBusyLow();
    
    delay(200);
}

void Display::spiTransfer(unsigned char data)
{
    digitalWrite(CS_PIN, LOW);
    SPI.transfer(data);
    digitalWrite(CS_PIN, HIGH);
}

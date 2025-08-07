#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include <SPI.h>

#define CS_PIN      15 // D8
#define DC_PIN      0  // D3
#define RST_PIN     5  // D1
#define BUSY_PIN    4  // D2

#define BLACK       0x0 // 000
#define WHITE       0x1 // 001
#define GREEN       0x2 // 010
#define BLUE        0x3 // 011
#define RED         0x4 // 100
#define YELLOW      0x5 // 101
#define ORANGE      0x6 // 110
#define CLEAN       0x7 // 111

#define DISPLAY_WIDTH 600
#define DISPLAY_HEIGHT 488
#define PIXELS_COUNT 146400

class Display {
public:
    Display();
    void init();
    void reset();
    void sendCommand(unsigned char command);
    void sendData(unsigned char data);
    void waitForBusyHigh();
    void waitForBusyLow();
    void clear(unsigned char color = 0x1);
    void startImageTransfer();
    void sendImageData(const unsigned char *image, unsigned int x, unsigned int y, unsigned int width, unsigned int height);
    void refresh();
    void sleep();
private:
    void spiTransfer(unsigned char data);
};

extern Display display;

#endif // DISPLAY_H

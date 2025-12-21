#ifndef DISPLAY_UPDATER_H
#define DISPLAY_UPDATER_H

#include <Arduino.h>
#include "display.h"
#include <network/network.h>

void handle_incoming_image(const uint8_t *data, size_t message_length);
uint32_t calculate_transfer_chunk_size(size_t data_set);
void request_cancel_transfer();

#endif

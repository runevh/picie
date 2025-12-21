#include "display_updater.h"
#include <user_interface.h>
#include <network/network.h>

static volatile bool g_cancel_transfer = false;

void request_cancel_transfer() {
    g_cancel_transfer = true;
}

void my_byte_handler(uint8_t byte)
{
    display.sendData(byte);
}

void handle_incoming_image(const uint8_t *data, size_t message_length)
{
    g_cancel_transfer = false;
    send_status(STATUS_UPDATING_IMAGE);

    display.init();
    display.startImageTransfer();

    uint32_t data_set = 0;

    while (data_set < PIXELS_COUNT)
    {
        uint32_t transfer_size = calculate_transfer_chunk_size(data_set);

        // Send how many bytes we want to receive
        send_message((uint8_t)0x21, (uint8_t *)&transfer_size, sizeof(transfer_size));

        if (!wait_and_read_bytes(transfer_size, 10000, my_byte_handler))
        {
            Serial.println("Timeout waiting for incoming data");
            display.sleep();
            send_status(STATUS_ERROR);
            return;
        }

        data_set += transfer_size;

        Serial.println();
        Serial.printf("Read %d bytes:\n", transfer_size);
    }

    display.refresh();
    display.waitForBusyHigh();
    display.sleep();

    send_status(STATUS_IDLE);
}

uint32_t calculate_transfer_chunk_size(size_t data_set)
{
    return min((uint32_t)PIXELS_COUNT - data_set, (uint32_t)(system_get_free_heap_size() * 0.75f));
}

#include "firmware_update.h"
#include <network/network.h>
#include <Updater.h>
#include <user_interface.h>
#include <algorithm>

static constexpr unsigned long OTA_CHUNK_TIMEOUT_MS = 20000;

void handle_incoming_firmware(const uint8_t *, size_t) {
    send_status(STATUS_UPDATING_FRAME);

    uint8_t sizeBuf[sizeof(uint32_t)] = {0};
    if (!wait_for_incoming_data(sizeof(uint32_t), 5000)) {
        send_status(STATUS_ERROR);
        return;
    }

    size_t readSize = read_buffer(sizeBuf, sizeof(uint32_t));
    if (readSize != sizeof(uint32_t)) {
        send_status(STATUS_ERROR);
        return;
    }

    uint32_t totalSize = *reinterpret_cast<uint32_t *>(sizeBuf);
    if (totalSize == 0) {
        send_status(STATUS_ERROR);
        return;
    }

    uint32_t maxSketch = ESP.getFreeSketchSpace();
    if (totalSize > maxSketch) {
        send_status(STATUS_ERROR);
        return;
    }

    if (!Update.begin(totalSize)) {
        send_status(STATUS_ERROR);
        return;
    }

    uint32_t received = 0;
    while (received < totalSize) {
        uint32_t remaining = totalSize - received;
        uint32_t chunkSize = std::min<uint32_t>(remaining, static_cast<uint32_t>(system_get_free_heap_size() * 0.5f));
        if (chunkSize == 0) {
            chunkSize = std::min<uint32_t>(remaining, 1024);
        }

        send_message(static_cast<uint8_t>(0x31), reinterpret_cast<uint8_t *>(&chunkSize), sizeof(chunkSize));

        if (!wait_for_incoming_data(chunkSize, OTA_CHUNK_TIMEOUT_MS)) {
            Update.end(false);
            send_status(STATUS_ERROR);
            return;
        }

        uint8_t *buffer = new uint8_t[chunkSize];
        size_t bytesRead = read_buffer(buffer, chunkSize);

        if (bytesRead != chunkSize) {
            delete[] buffer;
            Update.end(false);
            send_status(STATUS_ERROR);
            return;
        }

        size_t written = Update.write(buffer, chunkSize);
        delete[] buffer;

        if (written != chunkSize) {
            Update.end(false);
            send_status(STATUS_ERROR);
            return;
        }

        received += chunkSize;
    }

    if (!Update.end(true)) {
        send_status(STATUS_ERROR);
        return;
    }

    send_status(STATUS_IDLE);
    ESP.restart();
}

# TCP Communication
This describes the TCP communication protocol between the frame and backend server.

## Overview
The device connects to the backend TCP server using a persistent TCP connection and authenticates using a UUID and secret key.

After authentication, the backend can issue commands to request status or initiate a streamed image transfer.

## Authentication
### Initial messages
When the device connects, it must immediately send the following authentication message:
```
UUID (16 bytes) + Secret key (32 bytes)
```

- The secret is pre-shared during device provisioning.
- UUIDs are unique per device.

### Server Response

| Response       | Byte  |
|----------------|-------|
| `AUTH_OK`      | `0x10`|
| `AUTH_FAIL`    | `0x11` (then closes connection) |

## Command Protocol
After successful authentication, the server sends **1-byte command codes**. The device reads and responds accordingly.
### General flow
```
Server → Client: [Command byte]
Client → Server: [Response]
```

### Command 0x00: Request Device Status
**Server → Client**
```
0x00
```
**Client → Server**
```
RSSI (int8) + Uptime (uint32)
```

| Field   | Type    | Description                      |
|---------|---------|----------------------------------|
| RSSI    | int8    | Wi-Fi signal strength (dBm)      |
| Uptime  | uint32  | Device uptime in milliseconds    |

### Command 0x01: Start Image Transfer
**Server → Client**

```
0x01
```

**Client → Server**

```
Chunk Size (uint16)
```

#### Image Transfer Sequence

1. Server sends chunk of image data of the specified chunk size.
2. Client sends an ACK (0x06) after each chunk.
const getDeviceData = async (client) => {
  try {
    const rawBytes = await getRawData(photoId);

    client.send([0x10]); // Ask for image data
    const responseLength = 1 + 4 // int8 + uint32
    
    console.log(rawBytes.length);

    while (sentBytes < responseLength) {
      const sizeData = await client.waitForResponse(0x21)
      const size = sizeData.readUInt32LE(0);
      console.log(size);
      client.send(rawBytes.subarray(sentBytes, sentBytes + size));
      console.log("Sent " + size + " bytes");
      sentBytes += size;
    }

    console.log("Done sending");
  } catch (e) {
    console.error('Failed send data:', e);
  }
}
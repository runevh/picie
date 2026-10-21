// One image transfer per connection; a failed connection cannot be reused.
function beginImageTransfer(client, photoId, timeoutMs) {
    if (client.imageTransfer) throw new Error('Image transfer already active');
    let resolve, reject, settled = false;
    const completed = new Promise((yes, no) => { resolve = yes; reject = no; });
    completed.catch(() => {}); // Failure may arrive while the sender awaits a chunk.
    const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client.imageTransfer = null;
        if (error) reject(error); else resolve();
    };
    const transfer = {
        photoId, started: false, sent: false, completed,
        status(code) {
            if (code === 0x41 && !this.started) { this.started = true; return; }
            if (code === 0x40 && this.started && this.sent) { finish(); return; }
            this.fail(new Error('Unexpected device status during image transfer'));
        },
        fail(error) { finish(error); client.closeConnection(); },
        cancel: finish,
    };
    const timer = setTimeout(() => transfer.fail(new Error('Image confirmation timeout')), timeoutMs);
    client.imageTransfer = transfer;
    return transfer;
}
module.exports = { beginImageTransfer };

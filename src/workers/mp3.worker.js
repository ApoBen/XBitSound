import { Mp3Encoder } from '@breezystack/lamejs';

self.onmessage = (e) => {
    const { channels, sampleRate, samplesLeft, samplesRight } = e.data;

    try {
        const mp3Encoder = new Mp3Encoder(channels, sampleRate, 128);
        const sampleBlockSize = 1152;
        const mp3Data = [];

        const length = samplesLeft.length;

        // OPTIMIZATION: Allocate buffers ONCE
        const leftChunk = new Int16Array(sampleBlockSize);
        const rightChunk = samplesRight ? new Int16Array(sampleBlockSize) : null;

        for (let i = 0; i < length; i += sampleBlockSize) {
            const chunkLen = Math.min(sampleBlockSize, length - i);

            // Subarray is cheap (view), slice is copy. Use subarray.
            const leftView = (chunkLen === sampleBlockSize) ? leftChunk : leftChunk.subarray(0, chunkLen);
            const rightView = rightChunk ? ((chunkLen === sampleBlockSize) ? rightChunk : rightChunk.subarray(0, chunkLen)) : null;

            for (let j = 0; j < chunkLen; j++) {
                // PCM Conversion
                let valLeft = samplesLeft[i + j];
                valLeft = Math.max(-1, Math.min(1, valLeft));
                leftChunk[j] = (valLeft < 0 ? valLeft * 32768 : valLeft * 32767) | 0;

                if (rightChunk) {
                    let valRight = samplesRight[i + j];
                    valRight = Math.max(-1, Math.min(1, valRight));
                    rightChunk[j] = (valRight < 0 ? valRight * 32768 : valRight * 32767) | 0;
                }
            }

            const mp3buf = rightView
                ? mp3Encoder.encodeBuffer(leftView, rightView)
                : mp3Encoder.encodeBuffer(leftView);

            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        const mp3buf = mp3Encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        self.postMessage({ type: 'success', blob: new Blob(mp3Data, { type: 'audio/mp3' }) });

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};

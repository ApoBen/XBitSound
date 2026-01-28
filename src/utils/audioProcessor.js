import { Mp3Encoder } from '@breezystack/lamejs';

export const decodeAudio = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return { audioBuffer, audioContext };
};

export const processAudio = (audioBuffer, bitDepth, downsampleFactor = 1, audioContext) => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    let ctx = audioContext;
    if (!ctx || ctx.state === 'closed') {
        try {
            ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
        } catch (e) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);
    const step = Math.pow(2, bitDepth - 1);

    for (let c = 0; c < numberOfChannels; c++) {
        const inputData = audioBuffer.getChannelData(c);
        const outputData = newBuffer.getChannelData(c);

        let previousSample = 0;

        for (let i = 0; i < length; i++) {
            let sample;

            // Downsampling simulation (Sample & Hold)
            if (i % Math.floor(downsampleFactor) === 0) {
                sample = inputData[i];
                if (sample > 1) sample = 1;
                if (sample < -1) sample = -1;

                if (bitDepth < 32) {
                    sample = Math.round(sample * step) / step;
                }
                previousSample = sample;
            } else {
                sample = previousSample;
            }

            outputData[i] = sample;
        }
    }

    return newBuffer;
};

export const bufferToWav = (buffer, bitDepth, downsampleFactor) => {
    const numOfChan = buffer.numberOfChannels;
    const originalSampleRate = buffer.sampleRate;

    // PHYSICAL DOWNSAMPLING for Export
    let effectiveResampleStep = Math.max(1, Math.floor(downsampleFactor));

    // 16MB LIMIT ENFORCEMENT
    // Target Size (Bytes) = 16 * 1024 * 1024 = 16777216
    const TARGET_SIZE_BYTES = 16000000; // slightly under 16MB for safety

    const is8Bit = bitDepth <= 8;
    const bytesPerSample = is8Bit ? 1 : 2;
    // Current duration
    const duration = buffer.duration;

    // Approx Size = SampleRate * Channels * BytesPerSample * Duration + 44
    // We want Approx Size <= TARGET_SIZE_BYTES
    // So: Max SampleRate = (TARGET / Duration / Channels / BytesPerSample)

    const maxSafeSampleRate = (TARGET_SIZE_BYTES - 100) / duration / numOfChan / bytesPerSample;

    // Current planned sample rate
    let plannedSampleRate = originalSampleRate / effectiveResampleStep;

    if (plannedSampleRate > maxSafeSampleRate) {
        // We need to downsample MORE to fit
        // New Step = Original / MaxSafe
        effectiveResampleStep = Math.ceil(originalSampleRate / maxSafeSampleRate);
        console.log(`Auto-downsampling enabled. Target SR: ${maxSafeSampleRate}, New Step: ${effectiveResampleStep}`);
    }

    const newSampleRate = Math.round(originalSampleRate / effectiveResampleStep);

    // Use CEIL to ensure we have enough space for all iterations
    const newLength = Math.ceil(buffer.length / effectiveResampleStep);

    const length = newLength * numOfChan * bytesPerSample + 44 + 8; // +8 safe padding

    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;

    let pos = 44;

    // Extract channel data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    // Write Data
    for (let originalPos = 0; originalPos < buffer.length; originalPos += effectiveResampleStep) {
        if (pos >= length) break;

        for (i = 0; i < numOfChan; i++) {
            let val = channels[i][originalPos];
            if (!val && val !== 0) val = 0;
            val = Math.max(-1, Math.min(1, val));

            if (is8Bit) {
                val = ((val * 0.5 + 0.5) * 255);
                view.setUint8(pos, val);
                pos += 1;
            } else {
                val = (val < 0 ? val * 32768 : val * 32767) | 0;
                view.setInt16(pos, val, true);
                pos += 2;
            }
        }
    }

    const dataSize = pos - 44;
    const fileSize = pos;

    const setUint32 = (data, p) => view.setUint32(p, data, true);
    const setUint16 = (data, p) => view.setUint16(p, data, true);

    setUint32(0x46464952, 0); // "RIFF"
    setUint32(fileSize - 8, 4); // file length - 8
    setUint32(0x45564157, 8); // "WAVE"

    setUint32(0x20746d66, 12); // "fmt " chunk
    setUint32(16, 16); // length = 16
    setUint16(1, 20); // PCM (uncompressed)
    setUint16(numOfChan, 22);
    setUint32(newSampleRate, 24);
    setUint32(newSampleRate * numOfChan * bytesPerSample, 28);
    setUint16(numOfChan * bytesPerSample, 32);
    setUint16(is8Bit ? 8 : 16, 34);

    setUint32(0x61746164, 36); // "data" - chunk
    setUint32(dataSize, 40);

    return new Blob([bufferArr.slice(0, pos)], { type: 'audio/wav' });
}

export const bufferToMp3 = (buffer, downsampleFactor) => {
    try {
        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const mp3Encoder = new Mp3Encoder(channels, sampleRate, 128);
        const sampleBlockSize = 1152;
        const mp3Data = [];

        const samplesLeft = buffer.getChannelData(0);
        const samplesRight = channels > 1 ? buffer.getChannelData(1) : null;
        const length = samplesLeft.length;

        for (let i = 0; i < length; i += sampleBlockSize) {
            const chunkLen = Math.min(sampleBlockSize, length - i);
            const leftChunk = new Int16Array(chunkLen);
            const rightChunk = samplesRight ? new Int16Array(chunkLen) : null;

            for (let j = 0; j < chunkLen; j++) {
                // PCM Conversion
                let valLeft = samplesLeft[i + j];
                // Clamp and Scale
                valLeft = Math.max(-1, Math.min(1, valLeft));
                leftChunk[j] = (valLeft < 0 ? valLeft * 32768 : valLeft * 32767) | 0;

                if (rightChunk) {
                    let valRight = samplesRight[i + j];
                    valRight = Math.max(-1, Math.min(1, valRight));
                    rightChunk[j] = (valRight < 0 ? valRight * 32768 : valRight * 32767) | 0;
                }
            }

            const mp3buf = rightChunk
                ? mp3Encoder.encodeBuffer(leftChunk, rightChunk)
                : mp3Encoder.encodeBuffer(leftChunk);

            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        const mp3buf = mp3Encoder.flush();
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }

        return new Blob(mp3Data, { type: 'audio/mp3' });
    } catch (e) {
        console.error("MP3 Encoding Fatal Error:", e);
        throw e;
    }
}

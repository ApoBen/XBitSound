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
    const effectiveResampleStep = Math.max(1, Math.floor(downsampleFactor));
    const newSampleRate = Math.round(originalSampleRate / effectiveResampleStep);

    // FIX: Use CEIL to ensure we have enough space for all iterations
    const newLength = Math.ceil(buffer.length / effectiveResampleStep);

    // 8-BIT OPTIMIZATION
    const is8Bit = bitDepth <= 8;
    const bytesPerSample = is8Bit ? 1 : 2;

    // Add extra padding bytes just to be extremely safe against off-by-one writes via views
    const length = newLength * numOfChan * bytesPerSample + 44 + 8; // +8 safe padding

    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;

    // Start writing at data chunk (header later)
    let pos = 44;

    // Extract channel data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    // Write Data
    for (let originalPos = 0; originalPos < buffer.length; originalPos += effectiveResampleStep) {
        if (pos >= length) break; // Safety break

        for (i = 0; i < numOfChan; i++) {
            let val = channels[i][originalPos];
            if (!val && val !== 0) val = 0; // check NaN
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

    // Update actual data chunk size to what we wrote (excluding header)
    const dataSize = pos - 44;
    const fileSize = pos; // RIFF chunk size does not include first 8 bytes

    // Helper to write at specific offset
    const setUint32 = (data, p) => view.setUint32(p, data, true);
    const setUint16 = (data, p) => view.setUint16(p, data, true);

    setUint32(0x46464952, 0); // "RIFF"
    setUint32(fileSize - 8, 4); // file length - 8
    setUint32(0x45564157, 8); // "WAVE"

    setUint32(0x20746d66, 12); // "fmt " chunk
    setUint32(16, 16); // length = 16
    setUint16(1, 20); // PCM (uncompressed)
    setUint16(numOfChan, 22);
    setUint32(newSampleRate, 24); // ACTUAL NEW SAMPLE RATE
    setUint32(newSampleRate * numOfChan * bytesPerSample, 28); // byte rate
    setUint16(numOfChan * bytesPerSample, 32); // block-align
    setUint16(is8Bit ? 8 : 16, 34); // bits per sample

    setUint32(0x61746164, 36); // "data" - chunk
    setUint32(dataSize, 40); // chunk length (filesize - header)

    // Slice buffer to actual used size so no garbage at end
    return new Blob([bufferArr.slice(0, pos)], { type: 'audio/wav' });
}

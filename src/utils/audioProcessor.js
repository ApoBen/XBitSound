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

            // Downsampling simulation (Sample & Hold) for Playback
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
    // If we simulated 10x downsample, we can actually drop 9/10 samples to save space.
    // However, we must ensure the new sample rate is integer.
    const effectiveResampleStep = Math.floor(downsampleFactor);
    const newSampleRate = Math.round(originalSampleRate / effectiveResampleStep);

    // Calculate new length (approximate)
    const newLength = Math.floor(buffer.length / effectiveResampleStep);

    // 8-BIT OPTIMIZATION
    const is8Bit = bitDepth <= 8;
    const bytesPerSample = is8Bit ? 1 : 2;

    const length = newLength * numOfChan * bytesPerSample + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample;
    let offset = 0;

    // Start writing at data chunk (header later)
    let pos = 44;

    // Extract channel data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    // Write Data
    // We step through the ORIGINAL buffer by 'effectiveResampleStep'
    for (let originalPos = 0; originalPos < buffer.length; originalPos += effectiveResampleStep) {
        // Safety check
        if (pos >= length) break;

        for (i = 0; i < numOfChan; i++) {
            // Get the sample (it's already quantized/bitcrushed in 'buffer')
            // but we need to clamp again just in case
            let val = channels[i][originalPos];
            if (!val && val !== 0) val = 0; // check NaN
            val = Math.max(-1, Math.min(1, val));

            if (is8Bit) {
                // 8-bit is 0 to 255 unsigned
                // Map -1..1 to 0..255
                // val = -1 -> 0
                // val = 1 -> 255
                val = ((val * 0.5 + 0.5) * 255);
                view.setUint8(pos, val);
                pos += 1;
            } else {
                // 16-bit
                val = (val < 0 ? val * 32768 : val * 32767) | 0;
                view.setInt16(pos, val, true);
                pos += 2;
            }
        }
    }

    // Now write the correct header
    // Helper to write at specific offset
    const setUint32 = (data, p) => view.setUint32(p, data, true);
    const setUint16 = (data, p) => view.setUint16(p, data, true);

    setUint32(0x46464952, 0); // "RIFF"
    setUint32(length - 8, 4); // file length - 8
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
    setUint32(length - 44, 40); // chunk length (filesize - header)

    return new Blob([bufferArr], { type: 'audio/wav' });
}

import * as lamejs from 'lamejs';

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

    const newLength = Math.ceil(buffer.length / effectiveResampleStep);

    const is8Bit = bitDepth <= 8;
    const bytesPerSample = is8Bit ? 1 : 2;

    const length = newLength * numOfChan * bytesPerSample + 44 + 8;

    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;

    let pos = 44;

    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

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
    // MP3 Encoding using lamejs
    // MP3 supports specific sample rates. We should stick to standard if possible, 
    // or let lame handle resampling. But since we have manually downsampled data in the buffer (by holding samples),
    // we should ideally resample it properly.
    // Lamejs expects 16-bit integer input.

    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;

    // We will pass the full buffer to lame, but if we have physical downsampling intent
    // (effectiveResampleStep > 1), we should skip samples to feed lame the "low fidelity" rate?
    // Lame might complain about non-standard rates (e.g. 44100/10 = 4410).
    // Safer approach for MP3 is to keep standard rate 44.1kHz but encode the "blocky" signal.
    // This compresses very well anyway because the data is repetitive (10 samples same value).

    const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128); // 128kbps standard

    const maxSamples = 1152;
    const samplesLeft = buffer.getChannelData(0);
    const samplesRight = channels > 1 ? buffer.getChannelData(1) : undefined;

    // Convert float to 16-bit PCMs
    const sampleBlockSize = 1152;
    const mp3Data = [];

    // Process in blocks
    const length = samplesLeft.length;
    for (let i = 0; i < length; i += sampleBlockSize) {
        const leftChunk = [];
        const rightChunk = [];

        for (let j = 0; j < sampleBlockSize && (i + j) < length; j++) {
            let valLeft = samplesLeft[i + j];
            valLeft = (valLeft < 0 ? valLeft * 32768 : valLeft * 32767) | 0;
            leftChunk.push(valLeft);

            if (samplesRight) {
                let valRight = samplesRight[i + j];
                valRight = (valRight < 0 ? valRight * 32768 : valRight * 32767) | 0;
                rightChunk.push(valRight);
            } else {
                rightChunk.push(valLeft); // Mono -> Stereo copy if needed, or lame logic handles mono
            }
        }

        const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    const mp3buf = mp3Encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
}

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

    // Reuse provided context or create an offline one (preferred over creating new AudioContexts repeatedly)
    // If audioContext is not provided or is closed, fallback.
    // OfflineAudioContext is much lighter for this purpose as it doesn't hook to hardware output.
    let ctx = audioContext;
    if (!ctx || ctx.state === 'closed') {
        try {
            ctx = new OfflineAudioContext(numberOfChannels, length, sampleRate);
        } catch (e) {
            // Fallback for Safari/Legacy if OfflineAudioContext is weird, ensuring we don't crash but might leak if not careful.
            // But usually OfflineAudioContext is fine.
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // If using the main AudioContext, createBuffer is cheap.
    // If using OfflineAudioContext, it's also cheap.

    const newBuffer = ctx.createBuffer(numberOfChannels, length, sampleRate);

    // Calculate quantization step
    const step = Math.pow(2, bitDepth - 1);

    for (let c = 0; c < numberOfChannels; c++) {
        const inputData = audioBuffer.getChannelData(c);
        const outputData = newBuffer.getChannelData(c);

        let previousSample = 0;

        for (let i = 0; i < length; i++) {
            let sample;

            // Downsampling logic
            if (i % Math.floor(downsampleFactor) === 0) {
                sample = inputData[i];

                // Hard clipping
                if (sample > 1) sample = 1;
                if (sample < -1) sample = -1;

                // Bit Crushing
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

export const bufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit encoding (standard WAV)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < buffer.length) {
        for (i = 0; i < numOfChan; i++) {
            // clamp
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            // scale to 16-bit integer
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    return new Blob([bufferArr], { type: 'audio/wav' });
}

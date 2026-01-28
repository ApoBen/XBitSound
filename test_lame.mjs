import { Mp3Encoder } from '@breezystack/lamejs';

try {
    const encoder = new Mp3Encoder(1, 44100, 128);
    console.log("Success: Encoder created");
} catch (e) {
    console.error("Fail:", e);
}

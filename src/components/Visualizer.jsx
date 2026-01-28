import React, { useEffect, useRef } from 'react';

const Visualizer = ({ audioBuffer, isPlaying }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!audioBuffer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Get data
        const channelData = audioBuffer.getChannelData(0); // Left channel
        const totalSamples = channelData.length;
        // We can't show all samples, so we sample down
        const step = Math.ceil(totalSamples / width);
        const amp = height / 2;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#22d3ee'; // Cyan-400
            ctx.beginPath();

            // Simple waveform drawing (static)
            // To make it dynamic/animated during playback would require an AnalyserNode connected to the source.
            // Since our architecture uses a one-shot buffer source, connecting an AnalyserNode is possible but requires passing the node.

            // For now, let's just draw the static waveform effectively to look cool.
            // If isPlaying is true, we could maybe animate a scanline or something.

            for (let i = 0; i < width; i++) {
                const index = i * step;
                // Simple downsampling: take max/min in chunk or just nth sample
                // For performance, just nth sample
                let min = 1.0;
                let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const datum = channelData[index + j];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }

                // Draw vertical line for the chunk (better for dense audio)
                ctx.moveTo(i, (1 + min) * amp);
                ctx.lineTo(i, (1 + max) * amp);
            }

            ctx.stroke();

            if (isPlaying) {
                // Add a playback cursor or effect?
                // Let's rely on CSS animations for "liveness" on the player to allow this to be a nice static waveform view
            }
        };

        // Resize handler for responsiveness could be here, but fixed width for now or percentage
        // Actually, let's use clientWidth if we want full width

        draw();

    }, [audioBuffer]);

    return (
        <div className="w-full h-32 bg-black/20 rounded-xl border border-white/5 overflow-hidden backdrop-blur-sm relative">
            <canvas
                ref={canvasRef}
                width={600}
                height={128}
                className="w-full h-full opacity-60"
            />
            {isPlaying && (
                <div className="absolute inset-0 bg-cyan-500/5 animate-pulse pointer-events-none" />
            )}
        </div>
    );
};

export default Visualizer;

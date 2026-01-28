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
            ctx.fillStyle = '#22d3ee'; // Using fill for bars logic is often faster/cleaner for dense audio

            ctx.beginPath();

            // OPTIMIZATION: Limit the inner loop. 
            // Instead of scanning every single sample in 'step' (which could be 10k+),
            // we scan a fixed number of representative samples.
            const samplesToCheck = Math.min(step, 50); // check max 50 points per pixel column
            const skip = Math.ceil(step / samplesToCheck);

            for (let i = 0; i < width; i++) {
                const index = i * step;
                let min = 1.0;
                let max = -1.0;

                // Optimized inner loop
                for (let j = 0; j < samplesToCheck; j++) {
                    // Check bounds
                    if ((index + j * skip) >= totalSamples) break;

                    const datum = channelData[index + (j * skip)];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }

                // Fallback for silence
                if (max < min) { min = 0; max = 0; }

                // Map to Height
                // Center is height/2
                // Val -1 -> height
                // Val 1 -> 0
                const yMin = (1 - min) * (height / 2);
                const yMax = (1 - max) * (height / 2);

                // Draw vertical line from yMax to yMin
                ctx.moveTo(i, yMax);
                ctx.lineTo(i, yMin);
            }

            ctx.stroke();
        };

        // Defer drawing to next animation frame to let React render happen first
        const frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);

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

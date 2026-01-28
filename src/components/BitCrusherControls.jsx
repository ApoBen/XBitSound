import React from 'react';
import { motion } from 'framer-motion';

const Slider = ({ label, value, min, max, step, onChange, unit, marks }) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="w-full flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-mono tracking-wider">
                <span className="text-white/60 uppercase">{label}</span>
                <span className="text-cyan-400">{value} {unit}</span>
            </div>

            <div className="relative h-6 flex items-center group">
                {/* Track Background */}
                <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    {/* Fill */}
                    <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                        style={{ width: `${percentage}%` }}
                        layoutId={`fill-${label}`}
                    />
                </div>

                {/* Input */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Thumb Follower */}
                <motion.div
                    className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)] pointer-events-none z-0"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            </div>

            {/* Marks */}
            {marks && (
                <div className="flex justify-between text-white/20 text-[10px] uppercase font-mono px-1">
                    {marks.map((mark, i) => (
                        <span key={i}>{mark}</span>
                    ))}
                </div>
            )}
        </div>
    );
}

const BitCrusherControls = ({ bitDepth, setBitDepth, downsampleFactor, setDownsampleFactor, className = '' }) => {
    return (
        <div className={`w-full max-w-lg flex flex-col gap-6 ${className}`}>

            <Slider
                label="Resolution"
                value={bitDepth}
                min={1}
                max={16}
                step={1}
                onChange={setBitDepth}
                unit="BITS"
                marks={['1 Bit (Crushed)', '8 Bit (Retro)', '16 Bit (Clean)']}
            />

            <Slider
                label="Frequency"
                value={downsampleFactor}
                min={1}
                max={20}
                step={1}
                onChange={setDownsampleFactor}
                unit="Factor"
                marks={['Original (1x)', 'Low (10x)', 'Lofi (20x)']}
            />

        </div>
    );
};

export default BitCrusherControls;

import React from 'react';
import { motion } from 'framer-motion';

const BitCrusherControls = ({ bitDepth, setBitDepth, className = '' }) => {
    return (
        <div className={`w-full max-w-2xl bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 ${className}`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white/90">Bit Depth</h3>
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-mono border border-cyan-500/30">
                    {bitDepth} Bits
                </span>
            </div>

            <div className="relative h-12 flex items-center">
                {/* Track */}
                <div className="absolute w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                        style={{ width: `${((bitDepth - 1) / 15) * 100}%` }}
                    />
                </div>

                {/* Custom Range Input */}
                <input
                    type="range"
                    min="1"
                    max="16"
                    step="1"
                    value={bitDepth}
                    onChange={(e) => setBitDepth(Number(e.target.value))}
                    className="relative w-full h-12 opacity-0 cursor-pointer z-10"
                />

                {/* Thumb (Visual only, effectively follows the input via calculation or just purely CSS if possible, but for custom thumb we usually use standard range styling or a synced div. I will use standard range styling with Tailwind for simplicity but high polish) */}

                {/* Custom styled thumb follower - Actually, let's stick to standard input styling overrides or a simple follower. 
            For now, I'll rely on the native slider being invisible and drawing a fake thumb if I had complex requirements, 
            but native sliders are easier to access. I'll make the input visible but styled.
        */}
            </div>

            <div className="flex justify-between text-xs text-white/30 font-mono mt-2">
                <span>1 Bit (Crushed)</span>
                <span>8 Bit (Retro)</span>
                <span>16 Bit (Clean)</span>
            </div>

            <style jsx>{`
        input[type=range] {
          -webkit-appearance: none; 
          background: transparent; 
        }
        
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          margin-top: -10px; 
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
          position: relative;
          z-index: 20;
        }

        input[type=range]::-moz-range-thumb {
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background: #ffffff;
            cursor: pointer;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
        }
        
        /* Reset track to be invisible so custom track shows */
        input[type=range]::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            cursor: pointer;
            background: transparent;
        }
      `}</style>
        </div>
    );
};

export default BitCrusherControls;

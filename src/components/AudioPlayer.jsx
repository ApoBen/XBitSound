import React, { useEffect, useRef } from 'react';
import { Play, Pause, Download, Volume2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const AudioPlayer = ({
    isPlaying,
    onPlayPause,
    onStop,
    onDownload,
    processedUrl,
    originalName
}) => {

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-0 left-0 right-0 bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-white/10 p-6 z-50"
        >
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <MusicIcon />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-medium truncate max-w-[200px]">
                            {originalName || "Unknown Track"}
                        </span>
                        <span className="text-xs text-cyan-400">Processed Audio</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={onStop}
                        className="text-white/50 hover:text-white transition-colors"
                        title="Reset"
                    >
                        <RotateCcw size={20} />
                    </button>

                    <button
                        onClick={onPlayPause}
                        className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                    >
                        {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onDownload}
                        disabled={!processedUrl}
                        className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/5"
                    >
                        <Download size={18} />
                        <span>Download WAV</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const MusicIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
)

export default AudioPlayer;

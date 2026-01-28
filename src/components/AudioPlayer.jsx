import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Download, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const AudioPlayer = ({
    isPlaying,
    onPlayPause,
    onStop,
    onSeek,
    currentTime,
    duration,
    onDownload,
    processedUrl,
    originalName
}) => {
    const progressBarRef = useRef(null);

    const formatTime = (time) => {
        if (!time && time !== 0) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const handleSeek = (e) => {
        if (!progressBarRef.current || !duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        onSeek(percentage * duration);
    };

    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-0 left-0 right-0 bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-white/10 p-4 pb-8 z-50 safe-area-pb"
        >
            {/* Progress Bar Container - Clickable */}
            <div
                className="absolute top-0 left-0 w-full h-1.5 bg-white/10 cursor-pointer group"
                onClick={handleSeek}
                ref={progressBarRef}
            >
                <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 relative"
                    style={{ width: `${progress}%` }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 mt-2">

                {/* Info Area (Hidden on small mobile) */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg hidden sm:flex items-center justify-center shrink-0">
                        <MusicIcon />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-white font-medium truncate text-sm sm:text-base">
                            {originalName || "Unknown Track"}
                        </span>
                        <div className="flex gap-2 text-xs font-mono text-cyan-400">
                            <span>{formatTime(currentTime)}</span>
                            <span className="text-white/30">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 sm:gap-6">
                    <button
                        onClick={onStop}
                        className="text-white/50 hover:text-white transition-colors p-2"
                        title="Reset"
                    >
                        <RotateCcw size={18} />
                    </button>

                    <button
                        onClick={onPlayPause}
                        className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-4 flex-1">
                    <button
                        onClick={onDownload}
                        disabled={!processedUrl}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 text-sm font-medium whitespace-nowrap"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const MusicIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
)

export default AudioPlayer;

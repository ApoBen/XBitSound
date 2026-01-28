import React, { useCallback, useState } from 'react';
import { Upload, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DropZone = ({ onFileSelected }) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const onDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragActive(true);
    }, []);

    const onDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragActive(false);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragActive(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            onFileSelected(files[0]);
        }
    }, [onFileSelected]);

    const onFileInputChange = useCallback((e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileSelected(files[0]);
        }
    }, [onFileSelected]);

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative w-full max-w-2xl h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-sm overflow-hidden group
        ${isDragActive
                    ? 'border-cyan-400 bg-cyan-900/20 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                    : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                }`}
        >
            <input
                type="file"
                accept="audio/*"
                onChange={onFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            <AnimatePresence>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center text-center p-6 pointer-events-none"
                >
                    <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${isDragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/50'}`}>
                        {isDragActive ? <Upload size={48} /> : <Music size={48} />}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {isDragActive ? 'Drop it like it\'s hot!' : 'Drop your beat here'}
                    </h3>
                    <p className="text-white/40 text-sm max-w-md">
                        Drag & drop an audio file (MP3, WAV) or click to browse
                    </p>
                </motion.div>
            </AnimatePresence>

            {/* Decorative background elements */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500 rounded-full blur-3xl mix-blend-screen animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-cyan-500 rounded-full blur-3xl mix-blend-screen animate-pulse delay-700" />
            </div>
        </div>
    );
};

export default DropZone;

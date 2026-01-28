import React, { useState, useEffect, useRef } from 'react';
import DropZone from './components/DropZone';
import BitCrusherControls from './components/BitCrusherControls';
import AudioPlayer from './components/AudioPlayer';
import { decodeAudio, processAudio, bufferToWav } from './utils/audioProcessor';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [originalBuffer, setOriginalBuffer] = useState(null);
  const [processedBuffer, setProcessedBuffer] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [bitDepth, setBitDepth] = useState(12); // Default to slightly crunchy but recognizable
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState('');

  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const handleFileSelected = async (file) => {
    setIsProcessing(true);
    setFileName(file.name);
    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const { audioBuffer } = await decodeAudio(file);
      setOriginalBuffer(audioBuffer);
      // Processing will trigger via effect
    } catch (error) {
      console.error("Error loading file:", error);
      alert("Could not load audio file.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-process when buffer or bitDepth changes
  useEffect(() => {
    if (!originalBuffer) return;

    const runProcessing = async () => {
      setIsProcessing(true);
      // Small delay to allow UI to render spinner
      await new Promise(r => setTimeout(r, 10));

      const newBuffer = processAudio(originalBuffer, bitDepth);
      setProcessedBuffer(newBuffer);

      const wavBlob = bufferToWav(newBuffer);
      const url = URL.createObjectURL(wavBlob);
      setProcessedUrl(url);

      setIsProcessing(false);

      // If was playing, restart? Or just keep state? 
      // For now, stop to avoid glitching.
      stopAudio();
    };

    runProcessing();

    return () => {
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [originalBuffer, bitDepth]);

  const playAudio = () => {
    if (!processedBuffer || !audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = processedBuffer;
    source.connect(audioContextRef.current.destination);

    // Resume from pause time logic (simple version: start from 0 every time or implement offset)
    // Implementing pause/resume correctly with AudioBufferSourceNode requires tracking time.
    // For simplicity in this demo, we'll start from pauseTime.

    const offset = pauseTimeRef.current;
    source.start(0, offset);
    startTimeRef.current = audioContextRef.current.currentTime - offset;

    source.onended = () => {
      // Only if it ended naturally (not stopped by us)
      // logic is complex, keep it simple for now:
      // If we stopped it manually, we updated isPlaying.
      if (audioContextRef.current.currentTime - startTimeRef.current >= processedBuffer.duration) {
        setIsPlaying(false);
        pauseTimeRef.current = 0;
      }
    };

    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      // Calculate paused position
      pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) { }
      sourceNodeRef.current = null;
    }
    pauseTimeRef.current = 0;
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) pauseAudio();
    else playAudio();
  };

  const downloadFile = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `8bit_${fileName || 'audio'}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white overflow-hidden relative selection:bg-cyan-500/30">

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 flex flex-col h-screen">

        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">XBitSound</h1>
          </div>
          <a href="#" className="text-sm text-white/40 hover:text-white transition-colors">By Antigravity</a>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center gap-12 pb-32">

          <AnimatePresence mode="wait">
            {!originalBuffer ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full flex justify-center"
              >
                <DropZone onFileSelected={handleFileSelected} />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl flex flex-col items-center gap-8"
              >
                <div className="relative">
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 rounded-2xl">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
                    </div>
                  )}
                  <BitCrusherControls
                    bitDepth={bitDepth}
                    setBitDepth={setBitDepth}
                  />
                </div>

                <div className="text-center">
                  <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-2">
                    {fileName}
                  </h2>
                  <p className="text-cyan-400 font-mono text-sm">
                    {originalBuffer.duration.toFixed(2)}s • {originalBuffer.numberOfChannels} Ch • {originalBuffer.sampleRate} Hz
                  </p>
                </div>

                <button
                  onClick={() => {
                    stopAudio();
                    setOriginalBuffer(null);
                    setProcessedBuffer(null);
                  }}
                  className="text-white/30 hover:text-white text-sm transition-colors mt-4 hover:underline"
                >
                  Upload Different File
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </main>

        {/* Player Bar */}
        <AnimatePresence>
          {originalBuffer && (
            <AudioPlayer
              isPlaying={isPlaying}
              onPlayPause={togglePlay}
              onStop={stopAudio}
              onDownload={downloadFile}
              processedUrl={processedUrl}
              originalName={fileName}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default App;

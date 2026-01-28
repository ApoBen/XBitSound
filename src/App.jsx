import React, { useState, useEffect, useRef } from 'react';
import DropZone from './components/DropZone';
import BitCrusherControls from './components/BitCrusherControls';
import AudioPlayer from './components/AudioPlayer';
import Visualizer from './components/Visualizer';
import { decodeAudio, processAudio, bufferToWav } from './utils/audioProcessor';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [originalBuffer, setOriginalBuffer] = useState(null);
  const [processedBuffer, setProcessedBuffer] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);

  // IMMEDIATE state for slider UI (fast)
  const [bitDepth, setBitDepth] = useState(12);
  const [downsampleFactor, setDownsampleFactor] = useState(1);

  // DEBOUNCED state for audio processing (delayed)
  const [debouncedBitDepth, setDebouncedBitDepth] = useState(12);
  const [debouncedDownsampleFactor, setDebouncedDownsampleFactor] = useState(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const animationFrameRef = useRef(null);

  // DEBOUNCE LOGIC
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedBitDepth(bitDepth);
      setDebouncedDownsampleFactor(downsampleFactor);
    }, 300); // 300ms delay

    return () => clearTimeout(handler);
  }, [bitDepth, downsampleFactor]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const getAudioContext = () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new Ctx();
    }
    return audioContextRef.current;
  };

  const handleFileSelected = async (file) => {
    setIsProcessing(true);
    setFileName(file.name);
    stopAudio();
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const { audioBuffer } = await decodeAudio(file);
      setOriginalBuffer(audioBuffer);
    } catch (error) {
      console.error("Error loading file:", error);
      alert("Audio file could not be loaded.");
    } finally {
      setIsProcessing(false);
    }
  };

  // PROCESSING LOGIC (Listens to DEBOUNCED state)
  useEffect(() => {
    if (!originalBuffer) return;

    const runProcessing = async () => {
      setIsProcessing(true);
      setProcessedUrl(null);

      try {
        await new Promise(r => setTimeout(r, 10)); // Yield to UI

        const ctx = getAudioContext();

        // Use DEBOUNCED values here
        const newBuffer = processAudio(originalBuffer, debouncedBitDepth, debouncedDownsampleFactor, ctx);
        setProcessedBuffer(newBuffer);

        // SYNCHRONOUS WAV EXPORT
        const blob = bufferToWav(newBuffer, debouncedBitDepth, debouncedDownsampleFactor);

        if (processedUrl) URL.revokeObjectURL(processedUrl);
        setProcessedUrl(URL.createObjectURL(blob));
        if (isPlaying) stopAudio(false);

      } catch (err) {
        console.error("Processing error:", err);
        alert("Error generating audio: " + (err.message || String(err)));
      } finally {
        setIsProcessing(false);
      }
    };

    runProcessing();

    return () => {
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [originalBuffer, debouncedBitDepth, debouncedDownsampleFactor]);

  const updateProgress = () => {
    if (audioContextRef.current && isPlaying) {
      const now = audioContextRef.current.currentTime;
      const elapsed = now - startTimeRef.current;
      setCurrentTime(Math.min(elapsed, processedBuffer?.duration || 0));

      if (elapsed >= (processedBuffer?.duration || 0)) {
        setIsPlaying(false);
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPlaying]);

  const playAudio = async (startOffset) => {
    if (!processedBuffer) return;
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) { }
    }

    const source = ctx.createBufferSource();
    source.buffer = processedBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = isMuted ? 0 : volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNodeRef.current = gainNode;

    let offset = startOffset !== undefined ? startOffset : pauseTimeRef.current;
    if (offset >= processedBuffer.duration) offset = 0;

    try {
      source.start(0, offset);
    } catch (e) {
      console.warn("Could not start:", e);
      return;
    }

    startTimeRef.current = ctx.currentTime - offset;
    pauseTimeRef.current = offset;

    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        const ctx = getAudioContext();
        pauseTimeRef.current = ctx.currentTime - startTimeRef.current;
        setCurrentTime(pauseTimeRef.current);
      } catch (e) { }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const stopAudio = (reset = true) => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) { }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    if (reset) {
      pauseTimeRef.current = 0;
      setCurrentTime(0);
    }
  };

  const handleSeek = (time) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      pauseAudio();
    }

    pauseTimeRef.current = time;
    setCurrentTime(time);

    if (wasPlaying) {
      playAudio(time);
    }
  };

  const togglePlay = () => {
    if (isPlaying) pauseAudio();
    else playAudio();
  };

  const downloadFile = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `8bit_${fileName.replace(/\.[^/.]+$/, "")}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white overflow-hidden relative selection:bg-cyan-500/30 font-sans">

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[#0f0f13]">
        {/* Static Gradients instead of heavy blurs for performance */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-purple-900/10 to-transparent opacity-50" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-cyan-900/10 to-transparent opacity-50" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 flex flex-col h-screen">

        {/* Header */}
        <header className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-full animate-ping opacity-75" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              XBitSound
            </h1>
          </div>


        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center gap-6 pb-32 w-full max-w-4xl mx-auto">

          <AnimatePresence mode="wait">
            {!originalBuffer ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full flex justify-center py-10"
              >
                <DropZone onFileSelected={handleFileSelected} />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full flex flex-col items-center gap-6"
              >
                {/* Visualizer and Controls Container */}
                <div className="w-full bg-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden group">

                  {/* Glow effect */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-cyan-500 opacity-50" />

                  <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                      <div className="truncate pr-4">
                        <h2 className="text-xl md:text-2xl font-bold text-white mb-1 truncate">
                          {fileName}
                        </h2>
                        <p className="text-cyan-400/80 font-mono text-xs uppercase tracking-wide">
                          {originalBuffer.duration.toFixed(1)}s • {bitDepth} BIT • WAV
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          stopAudio();
                          setOriginalBuffer(null);
                          setProcessedBuffer(null);
                        }}
                        className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-transparent hover:border-white/10"
                      >
                        NEW FILE
                      </button>
                    </div>

                    <Visualizer audioBuffer={processedBuffer} isPlaying={isPlaying} />

                    <div className="relative py-2">
                      <BitCrusherControls
                        bitDepth={bitDepth}
                        setBitDepth={setBitDepth}
                        downsampleFactor={downsampleFactor}
                        setDownsampleFactor={setDownsampleFactor}
                        className="!bg-transparent !p-0 !border-0"
                      />
                      {isProcessing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0f0f13]/50 backdrop-blur-[2px] rounded-lg">
                          <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm">
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                            PROCESSING...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
              onStop={() => stopAudio(true)}
              onSeek={handleSeek}
              currentTime={currentTime}
              duration={processedBuffer?.duration || 0}
              onDownload={downloadFile}
              processedUrl={processedUrl}
              originalName={fileName}
              volume={volume}
              setVolume={setVolume}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default App;

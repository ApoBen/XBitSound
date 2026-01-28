import React, { useState, useEffect, useRef } from 'react';
import DropZone from './components/DropZone';
import BitCrusherControls from './components/BitCrusherControls';
import AudioPlayer from './components/AudioPlayer';
import Visualizer from './components/Visualizer';
import { decodeAudio, processAudio, bufferToWav, bufferToMp3 } from './utils/audioProcessor';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [originalBuffer, setOriginalBuffer] = useState(null);
  const [processedBuffer, setProcessedBuffer] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [bitDepth, setBitDepth] = useState(12);
  const [downsampleFactor, setDownsampleFactor] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [exportFormat, setExportFormat] = useState('wav'); // Default to WAV as requested

  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const animationFrameRef = useRef(null);

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

  useEffect(() => {
    if (!originalBuffer) return;

    const runProcessing = async () => {
      setIsProcessing(true);
      setProcessedUrl(null); // Clear stale URL preventing wrong format download
      try {
        await new Promise(r => setTimeout(r, 10)); // Yield to UI

        const ctx = getAudioContext();

        const newBuffer = processAudio(originalBuffer, bitDepth, downsampleFactor, ctx);
        setProcessedBuffer(newBuffer);

        // Generate Blob based on selected format
        let blob;
        if (exportFormat === 'mp3') {
          blob = bufferToMp3(newBuffer, downsampleFactor);
        } else {
          blob = bufferToWav(newBuffer, bitDepth, downsampleFactor);
        }

        if (processedUrl) URL.revokeObjectURL(processedUrl);
        const url = URL.createObjectURL(blob);
        setProcessedUrl(url);

        if (isPlaying) {
          stopAudio(false);
        }
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
  }, [originalBuffer, bitDepth, downsampleFactor, exportFormat]);

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
    source.connect(ctx.destination);

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
    const ext = exportFormat === 'mp3' ? 'mp3' : 'wav';
    a.download = `8bit_${fileName.replace(/\.[^/.]+$/, "")}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white overflow-hidden relative selection:bg-cyan-500/30 font-sans">

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-[pulse_8s_infinite]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/20 rounded-full blur-[120px] animate-[pulse_10s_infinite]" />
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

          {/* Format Toggle */}
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => setExportFormat('mp3')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${exportFormat === 'mp3' ? 'bg-cyan-500 text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
            >
              MP3
            </button>
            <button
              onClick={() => setExportFormat('wav')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${exportFormat === 'wav' ? 'bg-purple-500 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
            >
              WAV
            </button>
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
                          {originalBuffer.duration.toFixed(1)}s • {bitDepth} BIT • {exportFormat.toUpperCase()}
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

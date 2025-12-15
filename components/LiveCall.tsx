import React, { useEffect, useRef, useState } from 'react';
import { geminiService } from '../services/geminiService';
import { SimulationConfig } from '../types';

interface Props {
  config: SimulationConfig;
  onEndCall: () => void;
}

const LiveCall: React.FC<Props> = ({ config, onEndCall }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        await geminiService.connect(
          config,
          (frequencyData) => {
            if (mounted) drawVisualizer(frequencyData);
          },
          () => {
             if (mounted) setStatus('error');
          }
        );
        if (mounted) setStatus('connected');
      } catch (err) {
        console.error(err);
        if (mounted) setStatus('error');
      }
    };

    connect();

    return () => {
      mounted = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      geminiService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawVisualizer = (dataArray: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      barHeight = dataArray[i] / 2;

      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#a855f7');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8 text-center space-y-8">
      
      {status === 'connecting' && (
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-16 w-16 bg-blue-500 rounded-full mb-4 animate-bounce"></div>
          <h2 className="text-xl font-semibold text-blue-300">Connecting to Customer...</h2>
        </div>
      )}

      {status === 'error' && (
        <div className="text-red-400">
          <h2 className="text-xl font-bold">Connection Failed</h2>
          <p>Please check your microphone permissions and API key.</p>
          <button onClick={onEndCall} className="mt-4 px-6 py-2 bg-slate-700 rounded hover:bg-slate-600">
            Go Back
          </button>
        </div>
      )}

      {status === 'connected' && (
        <div className="w-full max-w-2xl flex flex-col items-center space-y-8 animate-fade-in">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative h-40 w-40 bg-slate-800 rounded-full border-4 border-blue-500/50 flex items-center justify-center overflow-hidden shadow-2xl">
               <span className="text-6xl">📞</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white tracking-tight">Call in Progress</h2>
            <p className="text-slate-400 text-lg">{config.scenario} &bull; {config.difficulty}</p>
          </div>

          <div className="w-full h-32 bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden backdrop-blur-sm">
            <canvas ref={canvasRef} width={600} height={128} className="w-full h-full" />
          </div>

          <div className="flex gap-4">
             <button
              onClick={onEndCall}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full shadow-lg transform transition hover:scale-105 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
              End Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveCall;

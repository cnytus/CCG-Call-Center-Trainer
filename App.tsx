import React, { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import LiveCall from './components/LiveCall';
import FeedbackReport from './components/FeedbackReport';
import { SimulationConfig, EvaluationResult } from './types';
import { geminiService } from './services/geminiService';

type AppState = 'SETUP' | 'CALL' | 'GENERATING_REPORT' | 'REPORT';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('SETUP');
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const handleStart = (newConfig: SimulationConfig) => {
    setConfig(newConfig);
    setAppState('CALL');
  };

  const handleEndCall = async () => {
    setAppState('GENERATING_REPORT');
    // Disconnect call first
    await geminiService.disconnect();
    
    // Generate report
    if (config) {
      try {
        const evalResult = await geminiService.generateEvaluation(config);
        setResult(evalResult);
        setAppState('REPORT');
      } catch (e) {
        console.error("Failed to generate report", e);
        // Reset to setup on critical error
        alert("Failed to generate evaluation report. Check console.");
        setAppState('SETUP');
      }
    }
  };

  const handleRestart = () => {
    setAppState('SETUP');
    setConfig(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="fixed top-0 w-full z-10 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                AI
             </div>
             <span className="font-semibold text-lg tracking-tight text-slate-200">Call Center Trainer</span>
          </div>
          {config && appState !== 'SETUP' && (
             <div className="text-sm text-slate-400">
               {config.scenario} ({config.language})
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        {appState === 'SETUP' && <SetupScreen onStart={handleStart} />}
        
        {appState === 'CALL' && config && (
          <LiveCall config={config} onEndCall={handleEndCall} />
        )}

        {appState === 'GENERATING_REPORT' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin"></div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Analyzing Performance</h2>
              <p className="text-slate-400">The AI is reviewing the transcript against criteria...</p>
            </div>
          </div>
        )}

        {appState === 'REPORT' && result && (
          <FeedbackReport result={result} onRestart={handleRestart} />
        )}
      </main>
    </div>
  );
};

export default App;

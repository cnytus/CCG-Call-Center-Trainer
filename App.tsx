
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import SetupScreen from './components/SetupScreen';
import LiveCall from './components/LiveCall';
import FeedbackReport from './components/FeedbackReport';
import ChatWidget from './components/ChatWidget';
import { SimulationConfig, EvaluationResult, CallCenterTrainerProps } from './types';
import { geminiService } from './services/geminiService';

type AppState = 'SETUP' | 'CALL' | 'GENERATING_REPORT' | 'REPORT';

export const CallCenterTrainer: React.FC<CallCenterTrainerProps> = ({
  initialAgentName = '',
  externalCriteria,
  externalClientName,
  externalScenario,
  onSessionComplete
}) => {
  const [appState, setAppState] = useState<AppState>('SETUP');
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  
  // Persist the workbook across sessions (only used if no external criteria provided)
  const [cachedWorkbook, setCachedWorkbook] = useState<XLSX.WorkBook | null>(null);

  const handleStart = (newConfig: SimulationConfig) => {
    setConfig(newConfig);
    setAppState('CALL');
  };

  const handleMockTest = () => {
      // Fix: Added missing required property 'improvementSuggestions' to match the EvaluationResult interface.
      const mockResult: EvaluationResult = {
          agentName: initialAgentName || "Test Agent",
          totalScore: 85,
          summary: "MOCK EVALUATION: The agent followed standard procedures correctly. Verification was successful. The tone was professional throughout the call.",
          callSummary: "A standard mock inquiry regarding an invoice.",
          improvementSuggestions: [
              "Maintain consistent use of the customer's name.",
              "Confirm identity before discussing account specifics.",
              "Summarize the next steps clearly before hanging up."
          ],
          criteriaBreakdown: externalCriteria ? externalCriteria.map((c, i) => ({
              id: c.id || String(i),
              name: c.name,
              maxPoints: c.maxPoints,
              score: Math.floor(c.maxPoints * 0.9),
              comment: "Mock comment: Performance was good."
          })) : [
              { id: "1", name: "Greeting", score: 10, maxPoints: 10, comment: "Clear and professional greeting." },
              { id: "2", name: "Verification", score: 10, maxPoints: 10, comment: "Correctly asked for customer number." },
              { id: "3", name: "Solution", score: 20, maxPoints: 30, comment: "Provided correct info, but missed one detail." },
              { id: "4", name: "Closing", score: 9, maxPoints: 10, comment: "Polite closing." }
          ],
          transcription: [
              { role: "model", text: "Hi, I have a question about my invoice." },
              { role: "user", text: "Hello, I can help. Can I have your customer number?" },
              { role: "model", text: "It is 12345." }
          ]
      };
      
      setResult(mockResult);
      setAppState('REPORT');
      if (onSessionComplete) onSessionComplete(mockResult);
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
        
        // Return data to parent application if callback exists
        if (onSessionComplete) {
            onSessionComplete(evalResult);
        }

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

  const handleSaveCorrection = (correctedResult: EvaluationResult) => {
    if (result) {
        // Send both the original AI result and the human corrected one
        geminiService.submitCorrection(result, correctedResult);
        // Update local state so UI reflects "saved"
        setResult(correctedResult);
        
        // Also send corrected result back to parent app
        if (onSessionComplete) {
            onSessionComplete(correctedResult);
        }
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30 flex flex-col relative">
      {/* Header */}
      <header className="sticky top-0 w-full z-10 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                AI
             </div>
             <span className="font-semibold text-lg tracking-tight text-slate-200">Call Center Trainer</span>
          </div>
          {config && appState !== 'SETUP' && (
             <div className="text-sm text-slate-400">
               {config.agentName} &bull; {config.scenario}
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        {appState === 'SETUP' && (
          <SetupScreen 
            onStart={handleStart} 
            workbook={cachedWorkbook}
            onWorkbookUpload={setCachedWorkbook}
            initialAgentName={initialAgentName}
            externalCriteria={externalCriteria}
            externalClientName={externalClientName}
            externalScenario={externalScenario}
            onRunMock={handleMockTest}
          />
        )}
        
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
          <FeedbackReport 
            result={result} 
            onRestart={handleRestart} 
            onSaveCorrection={handleSaveCorrection}
          />
        )}
      </main>
      
      {/* AI Supervisor Chat Widget */}
      <ChatWidget />
    </div>
  );
};

export default CallCenterTrainer;

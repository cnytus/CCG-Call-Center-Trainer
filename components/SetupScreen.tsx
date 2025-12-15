import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Difficulty, Language, DefaultScenario, SimulationConfig } from '../types';

interface Props {
  onStart: (config: SimulationConfig) => void;
}

const DEFAULT_CRITERIA = `
1. Opening: Did the agent greet professionally?
2. Empathy: Did the agent acknowledge the customer's issue?
3. Solution: Did the agent propose a valid solution?
4. Closing: Did the agent ask if there is anything else?
5. Tone: Was the agent polite and calm?
`;

interface ParsedSheet {
  sheetName: string;
  client: string;
  callType: string;
}

const SetupScreen: React.FC<Props> = ({ onStart }) => {
  const [mode, setMode] = useState<'manual' | 'file'>('manual');
  
  // Manual State
  const [scenario, setScenario] = useState<string>(DefaultScenario.CARGO_ISSUE);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [customContext, setCustomContext] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState(DEFAULT_CRITERIA);

  // File State
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [availableSheets, setAvailableSheets] = useState<ParsedSheet[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    setWorkbook(wb);

    // Parse sheet names "Client CallType"
    const parsed: ParsedSheet[] = wb.SheetNames.map(name => {
      // Split by first space
      const parts = name.trim().split(' ');
      const client = parts[0];
      const callType = parts.slice(1).join(' ') || 'General';
      return { sheetName: name, client, callType };
    });

    setAvailableSheets(parsed);
    if (parsed.length > 0) {
      setSelectedClient(parsed[0].client);
      // We'll set call type in the effect or render logic
    }
    setMode('file');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'file' && workbook) {
      // Find selected sheet
      const sheetInfo = availableSheets.find(
        s => s.client === selectedClient && s.callType === selectedCallType
      );
      
      if (!sheetInfo) {
        alert("Please select a valid Client and Call Type.");
        return;
      }

      const worksheet = workbook.Sheets[sheetInfo.sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);

      onStart({
        scenario: `${sheetInfo.client} - ${sheetInfo.callType}`,
        clientName: sheetInfo.client,
        callType: sheetInfo.callType,
        language,
        difficulty,
        // We pass the raw CSV data into context so Gemini knows the specific details
        customContext: `Config loaded from file: ${sheetInfo.sheetName}.\n\nDATA:\n${csvData}`,
        evaluationCriteria: csvData // Pass the same data for evaluation criteria
      });
    } else {
      onStart({ scenario, language, difficulty, customContext, evaluationCriteria });
    }
  };

  // Derived state for dropdowns
  const uniqueClients = Array.from(new Set(availableSheets.map(s => s.client)));
  const availableCallTypes = availableSheets
    .filter(s => s.client === selectedClient)
    .map(s => s.callType);

  // Auto-select first call type when client changes
  React.useEffect(() => {
    if (availableCallTypes.length > 0 && !availableCallTypes.includes(selectedCallType)) {
      setSelectedCallType(availableCallTypes[0]);
    }
  }, [selectedClient, availableCallTypes, selectedCallType]);

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl animate-fade-in">
      <h1 className="text-3xl font-bold mb-6 text-white text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Call Center AI Trainer
      </h1>

      {/* Mode Switcher */}
      <div className="flex bg-slate-900/50 p-1 rounded-lg mb-8">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            mode === 'manual' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Manual Setup
        </button>
        <button
          onClick={() => setMode('file')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            mode === 'file' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          Upload Criteria (Excel)
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Common Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Customer Language</label>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Object.values(Language).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Difficulty Level</label>
            <select 
              value={difficulty} 
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Object.values(Difficulty).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* File Mode UI */}
        {mode === 'file' && (
          <div className="space-y-6 border-t border-slate-700/50 pt-6">
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-800/30">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                <svg className="w-12 h-12 text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-lg font-medium text-white">
                  {workbook ? 'File Loaded' : 'Click to Upload Excel File'}
                </span>
                <span className="text-sm text-slate-400 mt-2">
                  {workbook ? `${availableSheets.length} scenarios found` : 'Sheets should be named "Client CallType"'}
                </span>
              </label>
            </div>

            {workbook && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select Client</label>
                  <select 
                    value={selectedClient} 
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {uniqueClients.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select Call Type</label>
                  <select 
                    value={selectedCallType} 
                    onChange={(e) => setSelectedCallType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                     {availableCallTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Mode UI */}
        {mode === 'manual' && (
          <div className="space-y-6 border-t border-slate-700/50 pt-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Scenario Topic</label>
              <select 
                value={scenario} 
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.values(DefaultScenario).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Custom Context (Optional)</label>
              <input
                type="text"
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="e.g., 'Customer lost package #999', 'Customer is a VIP'"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Evaluation Criteria</label>
              <textarea
                rows={5}
                value={evaluationCriteria}
                onChange={(e) => setEvaluationCriteria(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={mode === 'file' && !workbook}
          className={`w-full font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.01] ${
            mode === 'file' && !workbook 
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
          }`}
        >
          Start Training Session
        </button>
      </form>
    </div>
  );
};

export default SetupScreen;
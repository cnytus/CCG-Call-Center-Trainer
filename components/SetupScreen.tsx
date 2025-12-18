import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Difficulty, Language, SimulationConfig, ExternalCriterion, CallScenarioPreset } from '../types';
import { geminiService } from '../services/geminiService';
import { DPD_REAL_CALLS } from '../data/dpd_transcripts';
import { TRAINING_PRESETS } from '../data/presets';

interface Props {
  onStart: (config: SimulationConfig) => void;
  workbook: XLSX.WorkBook | null;
  onWorkbookUpload: (wb: XLSX.WorkBook) => void;
  initialAgentName?: string;
  externalCriteria?: ExternalCriterion[];
  externalClientName?: string;
  externalScenario?: string;
  onRunMock?: () => void;
}

const SetupScreen: React.FC<Props> = ({ 
  onStart, 
  workbook, 
  onWorkbookUpload,
  initialAgentName = '',
  externalCriteria,
  externalClientName = 'External Client',
  externalScenario = '',
  onRunMock
}) => {
  const [agentName, setAgentName] = useState(initialAgentName);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  
  // Selection state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  
  // Custom File State
  const [availableSheets, setAvailableSheets] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCallType, setSelectedCallType] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select preset if externalScenario matches "scenario 1", "scenario 2", etc.
  useEffect(() => {
    if (externalScenario && externalScenario.toLowerCase().startsWith('scenario')) {
      const preset = TRAINING_PRESETS.find(p => p.id === externalScenario.toLowerCase());
      if (preset) {
        setSelectedPresetId(preset.id);
      }
    } else if (externalCriteria && externalCriteria.length > 0) {
      setSelectedPresetId('external');
    }
  }, [externalScenario, externalCriteria]);

  useEffect(() => {
    if (workbook && !externalCriteria) {
      const parsed = workbook.SheetNames.map(name => {
        const parts = name.trim().split(' ');
        return { sheetName: name, client: parts[0], callType: parts.slice(1).join(' ') || 'General' };
      });
      setAvailableSheets(parsed);
      if (parsed.length > 0) setSelectedClient(parsed[0].client);
    }
  }, [workbook, externalCriteria]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    onWorkbookUpload(wb);
    setSelectedPresetId('custom-file');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return alert("Please enter Agent Name.");

    let config: SimulationConfig;

    const preset = TRAINING_PRESETS.find(p => p.id === selectedPresetId);
    
    if (preset) {
      config = {
        agentName: agentName.trim(),
        scenario: preset.title,
        clientName: preset.client,
        language,
        difficulty,
        customContext: preset.context,
        evaluationCriteria: preset.criteria.map(c => `${c.name} (${c.maxPoints}pts)`).join('\n'),
        structuredCriteria: preset.criteria
      };
    } else if (selectedPresetId === 'external' && externalCriteria) {
      config = {
        agentName: agentName.trim(),
        scenario: externalScenario || 'External Assessment',
        clientName: externalClientName,
        language,
        difficulty,
        customContext: `EXTERNAL QA MODE: ${externalScenario}`,
        evaluationCriteria: externalCriteria.map(c => `${c.name} (${c.maxPoints}pts)`).join('\n'),
        structuredCriteria: externalCriteria
      };
    } else if (selectedPresetId === 'custom-file' && workbook) {
      const sheet = availableSheets.find(s => s.client === selectedClient && s.callType === selectedCallType);
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheet.sheetName]);
      config = {
        agentName: agentName.trim(),
        scenario: `${sheet.client} - ${sheet.callType}`,
        clientName: sheet.client,
        language,
        difficulty,
        customContext: `Excel Upload: ${sheet.sheetName}`,
        evaluationCriteria: csv,
      };
    } else {
      alert("Please select a training scenario.");
      return;
    }

    onStart(config);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl animate-fade-in">
      <h1 className="text-3xl font-bold mb-8 text-white text-center bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
        Training Ground Setup
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Agent Name */}
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
          <label className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Trainee Identity</label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white text-xl font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Agent Name"
            required
          />
        </div>

        {/* Official Presets */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Select Official Training Scenario</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRAINING_PRESETS.map((p) => (
              <div 
                key={p.id}
                onClick={() => setSelectedPresetId(p.id)}
                className={`cursor-pointer p-5 rounded-xl border transition-all flex flex-col h-full ${
                  selectedPresetId === p.id 
                  ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10' 
                  : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-bold text-white mb-1">{p.title}</h3>
                <p className="text-xs text-slate-400 mb-4 flex-1">{p.description}</p>
                <div className="text-[10px] text-blue-400 font-mono bg-blue-900/30 px-2 py-1 rounded inline-block">
                  {p.id.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/50">
          {/* File Upload Mode */}
          <div 
            onClick={() => !workbook && fileInputRef.current?.click()}
            className={`p-6 rounded-xl border transition-all ${
              selectedPresetId === 'custom-file' 
              ? 'bg-purple-600/20 border-purple-500' 
              : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-4">
               <div className="p-3 bg-slate-800 rounded-lg text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
               </div>
               <div className="flex-1">
                  <h3 className="font-bold text-white">Custom Excel Upload</h3>
                  {workbook ? (
                    <div className="mt-2 text-xs">
                       <select 
                         value={selectedClient} 
                         onChange={(e) => { setSelectedPresetId('custom-file'); setSelectedClient(e.target.value); }}
                         className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                       >
                         {Array.from(new Set(availableSheets.map(s => s.client))).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                  ) : <p className="text-xs text-slate-500">Upload your own criteria sheet</p>}
               </div>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx,.xls" />
          </div>

          {/* Global Configs */}
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Language</label>
                   <select 
                     value={language} 
                     onChange={(e) => setLanguage(e.target.value as Language)}
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                   >
                     {Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Difficulty</label>
                   <select 
                     value={difficulty} 
                     onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                   >
                     {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                </div>
             </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-5 rounded-xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-3 text-lg"
        >
          <span>Initiate Simulation</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        {onRunMock && (
          <button type="button" onClick={onRunMock} className="w-full text-xs text-slate-600 hover:text-slate-400 underline py-2">
            Developer: Send Mock Result
          </button>
        )}
      </form>
    </div>
  );
};

export default SetupScreen;
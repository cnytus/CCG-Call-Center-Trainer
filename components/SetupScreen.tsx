import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Difficulty, Language, SimulationConfig, ExternalCriterion, CallScenarioPreset } from '../types';
import { DPD_STANDARD_INBOUND_CRITERIA } from '../data/dpd_criteria';

interface Props {
  onStart: (config: SimulationConfig) => void;
  workbook: XLSX.WorkBook | null;
  onWorkbookUpload: (wb: XLSX.WorkBook) => void;
  initialAgentName?: string;
  externalCriteria?: ExternalCriterion[];
  externalClientName?: string;
  externalScenario?: string;
  onRunMock?: () => void;
  availableScenarios: CallScenarioPreset[];
}

const SetupScreen: React.FC<Props> = ({ 
  onStart, 
  workbook, 
  onWorkbookUpload,
  initialAgentName = '',
  externalCriteria,
  externalClientName = 'DPD',
  externalScenario = '',
  onRunMock,
  availableScenarios
}) => {
  const [agentName, setAgentName] = useState(initialAgentName);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  
  // Selection state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  
  // Simulation Context
  const [client, setClient] = useState<string>(externalClientName || 'DPD');
  const [callType, setCallType] = useState<string>('Inbound');
  const [project, setProject] = useState<string>('Standart');

  // Custom File State
  const [availableSheets, setAvailableSheets] = useState<any[]>([]);
  const [selectedClientFile, setSelectedClientFile] = useState<string>('');
  const [selectedCallTypeFile, setSelectedCallTypeFile] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select preset if externalScenario matches "scenario 1", "scenario 2", etc.
  useEffect(() => {
    if (externalScenario && externalScenario.toLowerCase().startsWith('scenario')) {
      const preset = availableScenarios.find(p => p.id === externalScenario.toLowerCase());
      if (preset) {
        setSelectedPresetId(preset.id);
      }
    } else if (externalCriteria && externalCriteria.length > 0) {
      setSelectedPresetId('external');
    }
  }, [externalScenario, externalCriteria, availableScenarios]);

  // Sync client/project/calltype and LANGUAGE when a scenario is clicked
  useEffect(() => {
    const preset = availableScenarios.find(p => p.id === selectedPresetId);
    if (preset) {
      setClient(preset.client || 'DPD');
      if (preset.language) {
        setLanguage(preset.language);
      }
    }
  }, [selectedPresetId, availableScenarios]);

  // If Client is DPD and Project is Standard, default to German (override if not explicitly a custom preset language)
  useEffect(() => {
    const preset = availableScenarios.find(p => p.id === selectedPresetId);
    if (!preset?.language && client === 'DPD' && project === 'Standart') {
      setLanguage(Language.GERMAN);
    }
  }, [client, project, selectedPresetId, availableScenarios]);

  useEffect(() => {
    if (workbook && !externalCriteria) {
      const parsed = workbook.SheetNames.map(name => {
        const parts = name.trim().split(' ');
        return { sheetName: name, client: parts[0], callType: parts.slice(1).join(' ') || 'General' };
      });
      setAvailableSheets(parsed);
      if (parsed.length > 0) setSelectedClientFile(parsed[0].client);
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

    const preset = availableScenarios.find(p => p.id === selectedPresetId);
    
    // Check if we should override with the official DPD criteria from CSV
    const isDpdStandardInbound = client === 'DPD' && callType === 'Inbound' && project === 'Standart';

    if (preset) {
      config = {
        agentName: agentName.trim(),
        scenario: preset.title,
        clientName: client,
        callType: callType,
        project: project,
        language,
        difficulty,
        customContext: preset.context,
        evaluationCriteria: isDpdStandardInbound 
          ? DPD_STANDARD_INBOUND_CRITERIA.map(c => `${c.name} (${c.maxPoints}pts)`).join('\n')
          : preset.criteria.map(c => `${c.name} (${c.maxPoints}pts)`).join('\n'),
        structuredCriteria: isDpdStandardInbound ? DPD_STANDARD_INBOUND_CRITERIA : preset.criteria
      };
    } else if (selectedPresetId === 'external' && externalCriteria) {
      config = {
        agentName: agentName.trim(),
        scenario: externalScenario || 'External Assessment',
        clientName: client,
        callType: callType,
        project: project,
        language,
        difficulty,
        customContext: `EXTERNAL QA MODE: ${externalScenario}`,
        evaluationCriteria: externalCriteria.map(c => `${c.name} (${c.maxPoints}pts)`).join('\n'),
        structuredCriteria: externalCriteria
      };
    } else if (selectedPresetId === 'custom-file' && workbook) {
      const sheet = availableSheets.find(s => s.client === selectedClientFile && s.callType === selectedCallTypeFile);
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheet?.sheetName || workbook.SheetNames[0]]);
      config = {
        agentName: agentName.trim(),
        scenario: sheet ? `${sheet.client} - ${sheet.callType}` : 'Custom File Upload',
        clientName: client,
        callType: callType,
        project: project,
        language,
        difficulty,
        customContext: `Excel Upload: ${sheet?.sheetName || 'Active Sheet'}`,
        evaluationCriteria: csv,
      };
    } else if (isDpdStandardInbound) {
      config = {
        agentName: agentName.trim(),
        scenario: 'DPD Standard Inbound (Auto-Generated)',
        clientName: client,
        callType: callType,
        project: project,
        language,
        difficulty,
        customContext: 'DPD General Customer Inquiry (e.g., missed pickup or packet status).',
        evaluationCriteria: DPD_STANDARD_INBOUND_CRITERIA.map(c => `${c.name} (${c.maxPoints}pts)`).join('\n'),
        structuredCriteria: DPD_STANDARD_INBOUND_CRITERIA
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Client</label>
                  <select 
                    value={client} 
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                  >
                    <option value="DPD">DPD</option>
                    <option value="Iloxx">Iloxx</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Call Type</label>
                  <select 
                    value={callType} 
                    onChange={(e) => setCallType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                  >
                    <option value="Inbound">Inbound</option>
                    <option value="Outbound">Outbound</option>
                  </select>
                </div>
             </div>
             <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Project</label>
                <select 
                  value={project} 
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                >
                  <option value="Standart">Standart</option>
                  <option value="Kubi">Kubi</option>
                  <option value="Leadgenerierung Vertieb">Leadgenerierung Vertieb</option>
                </select>
             </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Select Training Scenario</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableScenarios.map((p) => (
              <div 
                key={p.id}
                onClick={() => setSelectedPresetId(p.id)}
                className={`cursor-pointer p-5 rounded-xl border transition-all flex flex-col h-full ${
                  selectedPresetId === p.id 
                  ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10' 
                  : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="text-3xl">{p.icon}</div>
                  {p.id.startsWith('custom-') && (
                    <span className="text-[8px] bg-purple-600 px-1.5 py-0.5 rounded text-white font-bold uppercase">Custom</span>
                  )}
                </div>
                <h3 className="font-bold text-white mb-1">{p.title}</h3>
                <p className="text-xs text-slate-400 mb-2 flex-1 line-clamp-2">{p.description}</p>
                <div className="flex justify-between items-center mt-auto">
                   <div className="text-[9px] text-blue-400 font-mono bg-blue-900/30 px-2 py-1 rounded">
                     {p.client} &bull; {p.id.split('-')[0].toUpperCase()}
                   </div>
                   {p.language && (
                     <div className="text-[9px] text-slate-500 font-bold uppercase bg-slate-900 px-2 py-1 rounded">
                       {p.language}
                     </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/50">
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
                         value={selectedClientFile} 
                         onChange={(e) => { setSelectedPresetId('custom-file'); setSelectedClientFile(e.target.value); }}
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
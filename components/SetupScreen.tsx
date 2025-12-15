import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Difficulty, Language, SimulationConfig } from '../types';

interface Props {
  onStart: (config: SimulationConfig) => void;
  workbook: XLSX.WorkBook | null;
  onWorkbookUpload: (wb: XLSX.WorkBook) => void;
}

interface ParsedSheet {
  sheetName: string;
  client: string;
  callType: string;
}

const SetupScreen: React.FC<Props> = ({ onStart, workbook, onWorkbookUpload }) => {
  // Agent Details
  const [agentName, setAgentName] = useState('');
  const [agentSurname, setAgentSurname] = useState('');

  // Settings
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  
  // File State
  const [availableSheets, setAvailableSheets] = useState<ParsedSheet[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse workbook whenever it changes (from props or upload)
  useEffect(() => {
    if (workbook) {
      const parsed: ParsedSheet[] = workbook.SheetNames.map(name => {
        const parts = name.trim().split(' ');
        const client = parts[0];
        const callType = parts.slice(1).join(' ') || 'General';
        return { sheetName: name, client, callType };
      });
      setAvailableSheets(parsed);
      
      // Select defaults if not already selected
      if (parsed.length > 0 && !selectedClient) {
        setSelectedClient(parsed[0].client);
      }
    }
  }, [workbook, selectedClient]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    onWorkbookUpload(wb); // Push up to App component
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentName.trim() || !agentSurname.trim()) {
      alert("Please enter Agent Name and Surname.");
      return;
    }

    if (!workbook) {
      alert("Please upload a criteria Excel file.");
      return;
    }

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
    const fullName = `${agentName.trim()} ${agentSurname.trim()}`;

    onStart({
      agentName: fullName,
      scenario: `${sheetInfo.client} - ${sheetInfo.callType}`,
      clientName: sheetInfo.client,
      callType: sheetInfo.callType,
      language,
      difficulty,
      customContext: `Config loaded from file: ${sheetInfo.sheetName}.\n\nDATA:\n${csvData}`,
      evaluationCriteria: csvData
    });
  };

  // Derived state for dropdowns
  const uniqueClients = Array.from(new Set(availableSheets.map(s => s.client)));
  const availableCallTypes = availableSheets
    .filter(s => s.client === selectedClient)
    .map(s => s.callType);

  // Auto-select first call type when client changes
  useEffect(() => {
    if (availableCallTypes.length > 0) {
      // Check if current selection is valid, if not pick first
      if (!availableCallTypes.includes(selectedCallType)) {
        setSelectedCallType(availableCallTypes[0]);
      }
    }
  }, [selectedClient, availableCallTypes, selectedCallType]);

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl animate-fade-in">
      <h1 className="text-3xl font-bold mb-8 text-white text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Agent Training Setup
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Agent Details Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-700/50">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Agent Name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="John"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Agent Surname</label>
            <input
              type="text"
              value={agentSurname}
              onChange={(e) => setAgentSurname(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Doe"
              required
            />
          </div>
        </div>

        {/* Configuration Section */}
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

        {/* File Upload / Selection Section */}
        <div className="space-y-6 pt-2">
            {!workbook ? (
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
                    Upload Evaluation Criteria (Excel)
                  </span>
                  <span className="text-sm text-slate-400 mt-2">
                    Sheets should be named "Client CallType"
                  </span>
                </label>
              </div>
            ) : (
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <span className="text-green-400">✓</span> Criteria Loaded
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Change File
                  </button>
                   <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Select Client</label>
                    <select 
                      value={selectedClient} 
                      onChange={(e) => setSelectedClient(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                       {availableCallTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
        </div>

        <button
          type="submit"
          disabled={!workbook || !agentName || !agentSurname}
          className={`w-full font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.01] ${
            (!workbook || !agentName || !agentSurname)
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
          }`}
        >
          Start Session
        </button>
      </form>
    </div>
  );
};

export default SetupScreen;
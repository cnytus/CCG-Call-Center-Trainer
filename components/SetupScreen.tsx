import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Difficulty, Language, SimulationConfig, ExternalCriterion } from '../types';
import { geminiService } from '../services/geminiService';
import { DPD_REAL_CALLS } from '../data/dpd_transcripts';

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

interface ParsedSheet {
  sheetName: string;
  client: string;
  callType: string;
}

// Preset Definitions
const PRESETS = [
  {
    id: 'dpd-inbound',
    name: 'DPD Inbound (Real Call Learning)',
    description: 'Learns from real DPD recordings. Uses text transcripts for analysis.',
    client: 'DPD',
    callType: 'Inbound',
    // We provide both text and audio paths. Logic prioritizes Audio for better persona, falls back to text.
    transcriptData: DPD_REAL_CALLS,
    // Audio URLs disabled to prevent 404 errors since files are not hosted yet.
    // To enable, place files in /public/audio/ and uncomment.
    audioUrls: [] as string[]
    /* 
    audioUrls: [
      '/audio/dpd_call_1.mp3',
      '/audio/dpd_call_2.mp3',
      '/audio/dpd_call_3.mp3',
      '/audio/dpd_call_4.mp3',
      '/audio/dpd_call_5.mp3'
    ]
    */
  }
];

const SetupScreen: React.FC<Props> = ({ 
  onStart, 
  workbook, 
  onWorkbookUpload,
  initialAgentName = '',
  externalCriteria,
  externalClientName = 'External Client',
  externalScenario = 'General Assessment',
  onRunMock
}) => {
  // Agent Details
  const [agentName, setAgentName] = useState(initialAgentName);
  
  // Settings
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  
  // File State
  const [availableSheets, setAvailableSheets] = useState<ParsedSheet[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  
  // Audio Learning State
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioContext, setAudioContext] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Parse workbook whenever it changes (only if no external criteria)
  useEffect(() => {
    if (workbook && !externalCriteria) {
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
  }, [workbook, selectedClient, externalCriteria]);

  const handlePresetSelect = async (presetId: string) => {
    setSelectedPreset(presetId);
    
    // Clear manual overrides
    setAudioContext('');
    setCachedWorkbook(null); // Reset workbook selection visually if desired
    
    if (presetId === 'custom') return;

    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    // 1. Check if we have "learned" this permanently in localStorage
    const storageKey = `ai_persona_${presetId}`;
    const cachedPersona = localStorage.getItem(storageKey);

    if (cachedPersona) {
        console.log("Loaded persona from cache");
        setAudioContext(cachedPersona);
    } else {
        // 2. If not, learn now
        setIsAnalyzingAudio(true);
        try {
            let analysis = '';
            
            // Priority 1: Try Audio Files (Better for Persona/Tone)
            if (preset.audioUrls && preset.audioUrls.length > 0) {
               try {
                  console.log("Attempting to analyze from Audio URLS...");
                  analysis = await geminiService.analyzePersonaFromUrls(preset.audioUrls);
                  console.log("Audio analysis successful.");
               } catch (audioErr) {
                  console.warn("Audio analysis failed (files might be missing), trying transcript fallback...", audioErr);
               }
            }
            
            // Priority 2: Fallback to Text Transcript
            if (!analysis && preset.transcriptData) {
               console.log("Analyzing from Transcript Data...");
               analysis = await geminiService.analyzePersonaFromText(preset.transcriptData);
            }
            
            if (analysis) {
               setAudioContext(analysis);
               localStorage.setItem(storageKey, analysis); // Make it permanent
            } else {
               throw new Error("No data available for analysis");
            }
        } catch (e) {
            console.error(e);
            alert("Could not load training data. Please ensure audio files are in public/audio/ or transcript data is valid.");
            setSelectedPreset('custom');
        } finally {
            setIsAnalyzingAudio(false);
        }
    }
  };

  // Helper needed to clear workbook if preset selected, 
  // but since workbook comes from props, we just handle UI logic.
  const setCachedWorkbook = (wb: any) => { /* no-op wrapper */ };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    onWorkbookUpload(wb);
    setSelectedPreset('custom'); // Switch to custom mode
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsAnalyzingAudio(true);
      try {
        const files = Array.from(e.target.files);
        const filesToProcess = files.slice(0, 3) as File[];
        const analysis = await geminiService.analyzeReferenceCalls(filesToProcess);
        setAudioContext(analysis);
        setSelectedPreset('custom'); // Manual upload implies custom
      } catch (error) {
        console.error("Audio analysis failed", error);
        alert("Failed to analyze audio files. Please try smaller files.");
      } finally {
        setIsAnalyzingAudio(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentName.trim()) {
      alert("Please enter Agent Name.");
      return;
    }

    let scenarioTitle = '';
    let clientName = '';
    let callType = '';
    let customContext = '';
    let evaluationCriteria = '';

    const preset = PRESETS.find(p => p.id === selectedPreset);

    if (externalCriteria && externalCriteria.length > 0) {
      // 1. External Data Mode (Has Priority)
      clientName = externalClientName;
      callType = externalScenario;
      scenarioTitle = `${clientName} - ${callType}`;
      const formattedCriteria = externalCriteria.map((c, i) => 
        `${i+1}. ${c.name} (Max Points: ${c.maxPoints})${c.description ? ` - Note: ${c.description}` : ''}`
      ).join('\n');
      evaluationCriteria = formattedCriteria;
      customContext = `QA ASSESSMENT MODE\n\n${formattedCriteria}`;
      if (audioContext) {
        customContext += `\n\nREAL CALL ANALYSIS:\n${audioContext}`;
      }

    } else if (preset) {
        // 2. Preset Mode
        clientName = preset.client;
        callType = preset.callType;
        scenarioTitle = `${clientName} - ${callType}`;
        // For presets, we might need default criteria if no excel uploaded.
        // For now, we'll use a generic set if workbook is missing.
        if (workbook) {
             const sheetInfo = availableSheets.find(s => s.client === selectedClient && s.callType === selectedCallType);
             if (sheetInfo) {
                 const ws = workbook.Sheets[sheetInfo.sheetName];
                 evaluationCriteria = XLSX.utils.sheet_to_csv(ws);
             }
        } else {
             evaluationCriteria = "1. Professional Greeting (10pts)\n2. Correct Verification (10pts)\n3. Solution Accuracy (30pts)\n4. Empathy (20pts)\n5. Closing (10pts)";
        }
        
        customContext = `PRESET SCENARIO: ${preset.name}\n\nEVALUATION CRITERIA:\n${evaluationCriteria}`;
        if (audioContext) {
            customContext += `\n\nREAL CALL ANALYSIS (PERMANENTLY LEARNED):\n${audioContext}`;
        }

    } else {
      // 3. Manual Excel Upload Mode
      if (!workbook) {
        alert("Please upload a criteria Excel file or select a Preset.");
        return;
      }
      const sheetInfo = availableSheets.find(
        s => s.client === selectedClient && s.callType === selectedCallType
      );
      if (!sheetInfo) {
        alert("Please select a valid Client and Call Type.");
        return;
      }
      const worksheet = workbook.Sheets[sheetInfo.sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      scenarioTitle = `${sheetInfo.client} - ${sheetInfo.callType}`;
      clientName = sheetInfo.client;
      callType = sheetInfo.callType;
      customContext = `Config loaded from file: ${sheetInfo.sheetName}.\n\nDATA:\n${csvData}`;
      evaluationCriteria = csvData;
      
      if (audioContext) {
        customContext += `\n\nREAL CALL ANALYSIS:\n${audioContext}`;
      }
    }

    onStart({
      agentName: agentName.trim(),
      scenario: scenarioTitle,
      clientName,
      callType,
      language,
      difficulty,
      customContext,
      evaluationCriteria,
      structuredCriteria: externalCriteria // Pass the raw object for strict evaluation
    });
  };

  // Derived state for dropdowns
  const uniqueClients = Array.from(new Set(availableSheets.map(s => s.client)));
  const availableCallTypes = availableSheets
    .filter(s => s.client === selectedClient)
    .map(s => s.callType);

  useEffect(() => {
    if (availableCallTypes.length > 0 && !externalCriteria && selectedPreset === 'custom') {
      if (!availableCallTypes.includes(selectedCallType)) {
        setSelectedCallType(availableCallTypes[0]);
      }
    }
  }, [selectedClient, availableCallTypes, selectedCallType, externalCriteria, selectedPreset]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl animate-fade-in relative">
      <h1 className="text-3xl font-bold mb-8 text-white text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Agent Training Setup
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Agent Details Section */}
        <div className="pb-6 border-b border-slate-700/50">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Agent Name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter full name"
              required
            />
          </div>
        </div>

        {/* Preset Selection - NEW SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div 
               onClick={() => handlePresetSelect('custom')}
               className={`cursor-pointer p-4 rounded-xl border transition-all ${selectedPreset === 'custom' || selectedPreset === '' ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
             >
                <div className="flex items-center gap-3">
                   <div className="p-2 rounded-lg bg-slate-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                   </div>
                   <div>
                      <h3 className="font-semibold text-white">Manual / Upload</h3>
                      <p className="text-xs text-slate-400">Configure from scratch</p>
                   </div>
                </div>
             </div>

             {PRESETS.map(preset => (
                <div 
                   key={preset.id}
                   onClick={() => handlePresetSelect(preset.id)}
                   className={`cursor-pointer p-4 rounded-xl border transition-all ${selectedPreset === preset.id ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/10' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                >
                   <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-900/50">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                         </svg>
                      </div>
                      <div className="flex-1">
                         <h3 className="font-semibold text-white">{preset.name}</h3>
                         <p className="text-xs text-slate-400">Pre-trained on real calls</p>
                      </div>
                      {selectedPreset === preset.id && isAnalyzingAudio && (
                         <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {selectedPreset === preset.id && !isAnalyzingAudio && audioContext && (
                         <span className="text-green-400 text-xs font-bold">READY</span>
                      )}
                   </div>
                </div>
             ))}
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

        {/* Dynamic Section: External Data vs File Upload */}
        <div className="space-y-6 pt-2">
            {externalCriteria && externalCriteria.length > 0 ? (
              // EXTERNAL DATA MODE
              <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-lg">External Criteria Loaded</h3>
                    <p className="text-sm text-blue-300">
                      Testing: {externalClientName} - {externalScenario}
                    </p>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                  {externalCriteria.map((c, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-slate-900/50 rounded border border-slate-700/50">
                      <span className="text-slate-200">{c.name}</span>
                      <span className="text-slate-400 font-mono">{c.maxPoints} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (selectedPreset === 'custom' || selectedPreset === '') ? (
              // FILE UPLOAD MODE (Only show if Custom is selected)
              <>
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
                
                {/* REFERENCE AUDIO SECTION (Custom Only) */}
                <div className="border-t border-slate-700/50 pt-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center justify-between">
                     <span>Enhance with Real Calls (Optional)</span>
                     <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">MP3, WAV</span>
                  </label>
                  
                  {!audioContext ? (
                    <div 
                      onClick={() => !isAnalyzingAudio && audioInputRef.current?.click()}
                      className={`border border-dashed border-slate-600 rounded-xl p-4 flex items-center justify-center gap-3 transition-colors ${isAnalyzingAudio ? 'bg-slate-800 cursor-wait' : 'bg-slate-800/30 hover:bg-slate-800 hover:border-purple-500 cursor-pointer'}`}
                    >
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={handleAudioUpload}
                        className="hidden"
                      />
                      {isAnalyzingAudio ? (
                        <>
                           <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                           <span className="text-purple-300 text-sm">Analyzing audio patterns...</span>
                        </>
                      ) : (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-slate-400 text-sm">Upload real call samples</span>
                        </>
                      )}
                    </div>
                  ) : (
                     <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 flex items-start gap-3">
                         <div className="bg-purple-500/20 p-1.5 rounded text-purple-400 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                         </div>
                         <div className="flex-1">
                            <h4 className="text-purple-200 text-sm font-semibold">AI Training Complete</h4>
                            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{audioContext}</p>
                            <button 
                              type="button" 
                              onClick={() => { setAudioContext(''); if(audioInputRef.current) audioInputRef.current.value = ''; }}
                              className="text-xs text-red-400 hover:text-red-300 mt-2 underline"
                            >
                              Clear & Re-upload
                            </button>
                         </div>
                     </div>
                  )}
                </div>
              </>
            ) : (
                // PRESET ACTIVE DISPLAY
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-purple-900/30 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Using DPD Inbound Profile</h3>
                        <p className="text-slate-400 text-sm max-w-md mx-auto mt-2">
                            This session is configured using pre-analyzed patterns from real DPD calls.
                            The AI will adopt the tone, vocabulary, and issues typical of these customers.
                        </p>
                    </div>
                    {isAnalyzingAudio && <p className="text-purple-400 animate-pulse">Initializing training data...</p>}
                </div>
            )}
        </div>

        <button
          type="submit"
          disabled={!agentName || isAnalyzingAudio || (selectedPreset === 'custom' && !workbook && !externalCriteria)}
          className={`w-full font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.01] ${
            (!agentName || isAnalyzingAudio || (selectedPreset === 'custom' && !workbook && !externalCriteria))
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
          }`}
        >
          {isAnalyzingAudio ? 'Initializing Preset...' : 'Start Session'}
        </button>

        {onRunMock && (
            <div className="pt-4 text-center border-t border-slate-800">
                <button
                    type="button"
                    onClick={onRunMock}
                    className="text-xs text-slate-500 hover:text-slate-300 underline"
                >
                    Developer: Test Integration (Send Mock Data)
                </button>
            </div>
        )}
      </form>
    </div>
  );
};

export default SetupScreen;
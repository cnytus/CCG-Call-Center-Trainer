import React, { useState } from 'react';
import { CallScenarioPreset, ExternalCriterion, Language, Difficulty } from '../types';
import { DPD_STANDARD_INBOUND_CRITERIA } from '../data/dpd_criteria';

interface Props {
  onSave: (scenario: CallScenarioPreset) => void;
  onCancel: () => void;
}

const EMOJI_OPTIONS = ['📦', '📞', '💳', '🔐', '🚛', '🏗️', '🏠', '🛒', '⚙️', '⚠️'];

const ScenarioBuilder: React.FC<Props> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('DPD');
  const [callType, setCallType] = useState('Inbound');
  const [project, setProject] = useState('Standart');
  const [icon, setIcon] = useState('📦');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !context) return alert("Please fill in Title and Customer Context.");

    let criteria: ExternalCriterion[] = [];
    if (client === 'DPD' && callType === 'Inbound' && project === 'Standart') {
      criteria = DPD_STANDARD_INBOUND_CRITERIA;
    } else {
      criteria = [
        { name: 'Professional Greeting', maxPoints: 10, description: 'Proper branding used' },
        { name: 'Problem Solving', maxPoints: 40, description: 'Accuracy of resolution' },
        { name: 'Tone & Soft Skills', maxPoints: 30, description: 'Empathy and patience' },
        { name: 'Closing', maxPoints: 20, description: 'Call wrapped correctly' }
      ];
    }

    const newScenario: CallScenarioPreset = {
      id: `custom-${Date.now()}`,
      title,
      description,
      client,
      icon,
      context,
      criteria,
      language
    };

    onSave(newScenario);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl animate-fade-in">
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="p-2 bg-blue-600 rounded-lg">🛠️</span>
          Scenario Builder
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-white transition">Cancel</button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scenario Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Frustrated Late Delivery"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Short Description</label>
              <input 
                type="text" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Appears on the scenario card"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Language</label>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  {Object.values(Language).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Icon</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button 
                      key={e} 
                      type="button"
                      onClick={() => setIcon(e)}
                      className={`text-2xl p-2 rounded-lg border transition ${icon === e ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Evaluation Mapping</h3>
            <p className="text-xs text-slate-500">Map this scenario to an existing criteria set by selecting the project details.</p>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Client</label>
                <select value={client} onChange={(e) => setClient(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white">
                  <option value="DPD">DPD</option>
                  <option value="Iloxx">Iloxx</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Call Type</label>
                <select value={callType} onChange={(e) => setCallType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white">
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Project</label>
                <select value={project} onChange={(e) => setProject(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white">
                  <option value="Standart">Standart</option>
                  <option value="Kubi">Kubi</option>
                  <option value="Leadgenerierung Vertieb">Leadgenerierung Vertieb</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-[10px] text-blue-300">
              <div className="font-bold mb-1">MAPPED CRITERIA SET:</div>
              {client === 'DPD' && callType === 'Inbound' && project === 'Standart' 
                ? 'Official DPD Standard Inbound Scorecard' 
                : 'Generic Performance Scorecard'}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Persona & Behavior (Context)</label>
          <textarea 
            value={context} 
            onChange={(e) => setContext(e.target.value)}
            rows={6}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            placeholder={`CUSTOMER PERSONA: Frau Schmidt.
PROBLEM: Package arrived wet.
BEHAVIOR: You are very direct and expect an immediate resolution or a discount code.`}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="submit" 
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-[1.01]"
          >
            Create & Add Scenario
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScenarioBuilder;
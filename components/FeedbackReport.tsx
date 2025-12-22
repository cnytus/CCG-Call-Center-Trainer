import React, { useState, useEffect } from 'react';
import { EvaluationResult, CriterionEvaluation } from '../types';

interface Props {
  result: EvaluationResult;
  onRestart: () => void;
  onSaveCorrection: (correctedResult: EvaluationResult) => void;
}

const FeedbackReport: React.FC<Props> = ({ result, onRestart, onSaveCorrection }) => {
  const [editableResult, setEditableResult] = useState<EvaluationResult>(result);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    const totalMax = editableResult.criteriaBreakdown.reduce((sum, item) => sum + item.maxPoints, 0);
    const totalEarned = editableResult.criteriaBreakdown.reduce((sum, item) => sum + item.score, 0);
    let normalizedScore = 0;
    if (totalMax > 0) normalizedScore = Math.round((totalEarned / totalMax) * 100);
    setEditableResult(prev => ({ ...prev, totalScore: normalizedScore }));
  }, [editableResult.criteriaBreakdown]);

  const handleScoreChange = (index: number, newScore: number) => {
    const newItems = [...editableResult.criteriaBreakdown];
    newItems[index] = { ...newItems[index], score: newScore };
    setEditableResult({ ...editableResult, criteriaBreakdown: newItems });
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleCommentChange = (index: number, newComment: string) => {
    const newItems = [...editableResult.criteriaBreakdown];
    newItems[index] = { ...newItems[index], comment: newComment };
    setEditableResult({ ...editableResult, criteriaBreakdown: newItems });
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditableResult({ ...editableResult, summary: e.target.value });
      setHasChanges(true);
      setSaveStatus('idle');
  };

  const handleSave = () => {
      onSaveCorrection(editableResult);
      setSaveStatus('saved');
      setHasChanges(false);
  };

  const getScoreColor = (score: number, max: number = 100) => {
    const percentage = (score / max) * 100;
    if (percentage >= 90) return '#4ade80';
    if (percentage >= 70) return '#facc15';
    return '#f87171';
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Evaluation Report</h1>
          <p className="text-slate-400 mt-1 text-lg">Agent: <span className="text-blue-400 font-semibold">{editableResult.agentName}</span></p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={handleSave}
                disabled={!hasChanges}
                className={`px-6 py-3 rounded-lg transition text-white font-medium shadow-md flex items-center gap-2 ${
                    hasChanges ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-700 text-slate-400'
                }`}
            >
                {saveStatus === 'saved' ? 'Saved & Learned' : 'Submit Correction'}
            </button>
            <button onClick={onRestart} className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-white font-medium shadow-md">
                Start New Session
            </button>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg flex flex-col items-center justify-center h-full">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider mb-4">Overall Score</h3>
          <div className="relative w-full h-32 flex items-center justify-center">
             <span className="text-6xl font-black text-white" style={{ color: getScoreColor(editableResult.totalScore) }}>
                 {editableResult.totalScore}%
             </span>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg flex flex-col">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider mb-3">Manager Performance Review</h3>
          <textarea
            value={editableResult.summary}
            onChange={handleSummaryChange}
            className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-200 leading-relaxed resize-none focus:ring-1 focus:ring-blue-500 outline-none text-sm min-h-[120px]"
          />
        </div>
      </div>

      {/* Improvement Suggestions & Call Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-6 shadow-lg">
              <h3 className="text-blue-400 font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                Call Context Summary
              </h3>
              <p className="text-slate-300 leading-relaxed italic text-sm">
                "{editableResult.callSummary}"
              </p>
          </div>

          <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-6 shadow-lg">
              <h3 className="text-amber-400 font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                QA Manager Improvement Roadmap
              </h3>
              <ul className="space-y-2">
                {editableResult.improvementSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
                {editableResult.improvementSuggestions.length === 0 && (
                  <p className="text-slate-500 text-xs italic">No specific suggestions generated for this interaction.</p>
                )}
              </ul>
          </div>
      </div>

      {/* Detailed Scorecard Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-700">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider text-sm">Detailed Scorecard</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                <th className="p-4 border-b border-slate-700 font-medium w-1/4">Criterion</th>
                <th className="p-4 border-b border-slate-700 font-medium text-center w-24">Score</th>
                <th className="p-4 border-b border-slate-700 font-medium">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {editableResult.criteriaBreakdown?.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 text-white font-medium text-sm">{item.name}</td>
                  <td className="p-4 text-center">
                    <input 
                        type="number"
                        min="0"
                        max={item.maxPoints}
                        value={item.score}
                        onChange={(e) => handleScoreChange(idx, parseInt(e.target.value) || 0)}
                        className="w-16 bg-slate-900 border border-slate-600 rounded p-1 text-center text-white text-sm"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">/ {item.maxPoints}</div>
                  </td>
                  <td className="p-4">
                      <textarea 
                        value={item.comment}
                        onChange={(e) => handleCommentChange(idx, e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-600 focus:bg-slate-900 rounded p-2 text-xs text-slate-300 transition-all outline-none resize-y min-h-[50px]"
                      />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-700">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider text-sm">Transcript</h3>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto space-y-4">
          {editableResult.transcription.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                t.role === 'user' ? 'bg-blue-600/20 text-blue-100' : 'bg-slate-700/50 text-slate-200'
              }`}>
                <p className="text-[10px] font-bold mb-1 uppercase opacity-50">{t.role === 'user' ? 'Agent' : 'Customer'}</p>
                <p>{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedbackReport;
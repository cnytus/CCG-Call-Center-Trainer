import React, { useState, useEffect } from 'react';
import { EvaluationResult, CriterionEvaluation } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  result: EvaluationResult;
  onRestart: () => void;
  onSaveCorrection: (correctedResult: EvaluationResult) => void;
}

const FeedbackReport: React.FC<Props> = ({ result, onRestart, onSaveCorrection }) => {
  // Local state for editing
  const [editableResult, setEditableResult] = useState<EvaluationResult>(result);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Recalculate total score when individual items change
  useEffect(() => {
    const totalMax = editableResult.criteriaBreakdown.reduce((sum, item) => sum + item.maxPoints, 0);
    const totalEarned = editableResult.criteriaBreakdown.reduce((sum, item) => sum + item.score, 0);
    
    // Normalize to 100 scale if totalMax is not 0
    let normalizedScore = 0;
    if (totalMax > 0) {
        normalizedScore = Math.round((totalEarned / totalMax) * 100);
    }

    setEditableResult(prev => ({
        ...prev,
        totalScore: normalizedScore
    }));
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

  const chartData = [
    { name: 'Total Score', value: editableResult.totalScore }
  ];

  const getScoreColor = (score: number, max: number = 100) => {
    const percentage = (score / max) * 100;
    if (percentage >= 90) return '#4ade80'; // green-400
    if (percentage >= 70) return '#facc15'; // yellow-400
    return '#f87171'; // red-400
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
                {saveStatus === 'saved' ? (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Saved & Learned
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Submit Correction
                    </>
                )}
            </button>
            <button 
                onClick={onRestart}
                className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-white font-medium shadow-md"
            >
            Start New Session
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Card */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg flex flex-col items-center justify-center">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider mb-2">Overall Score</h3>
          <div className="relative w-full h-40">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                    <Bar dataKey="value" radius={[0, 20, 20, 0]} barSize={40}>
                        <Cell fill={getScoreColor(editableResult.totalScore)} />
                    </Bar>
                </BarChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-5xl font-bold text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                     {editableResult.totalScore}%
                 </span>
             </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="md:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg flex flex-col">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider mb-2 flex justify-between">
              <span>Executive Summary</span>
              <span className="text-xs text-slate-500 normal-case">You can edit this text</span>
          </h3>
          <textarea
            value={editableResult.summary}
            onChange={handleSummaryChange}
            className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-200 leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Detailed Scorecard Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider">Detailed Scorecard</h3>
          <span className="text-xs text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full border border-blue-500/30">QA Mode: Editable</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase">
                <th className="p-4 border-b border-slate-700 font-medium w-1/4">Criterion</th>
                <th className="p-4 border-b border-slate-700 font-medium text-center w-32">Score</th>
                <th className="p-4 border-b border-slate-700 font-medium w-1/2">Feedback / Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {editableResult.criteriaBreakdown?.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-700/30 transition-colors group">
                  <td className="p-4 text-white font-medium align-top pt-5">{item.name}</td>
                  <td className="p-4 text-center align-top">
                    <div className="flex flex-col items-center gap-2">
                        <input 
                            type="number"
                            min="0"
                            max={item.maxPoints}
                            value={item.score}
                            onChange={(e) => handleScoreChange(idx, parseInt(e.target.value) || 0)}
                            className="w-16 bg-slate-900 border border-slate-600 rounded p-2 text-center text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-xs text-slate-500">Max: {item.maxPoints}</span>
                    </div>
                  </td>
                  <td className="p-4 align-top">
                      <textarea 
                        value={item.comment}
                        onChange={(e) => handleCommentChange(idx, e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-slate-600 focus:border-blue-500 focus:bg-slate-900 rounded p-2 text-sm text-slate-300 transition-all outline-none resize-y min-h-[60px]"
                        placeholder="Enter feedback..."
                      />
                  </td>
                </tr>
              ))}
              {(!editableResult.criteriaBreakdown || editableResult.criteriaBreakdown.length === 0) && (
                <tr>
                   <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                     No specific criteria breakdown available.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transcript Accordion */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-700">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider">Conversation Transcript</h3>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto space-y-4">
          {editableResult.transcription.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                t.role === 'user' 
                  ? 'bg-blue-600/20 text-blue-100 rounded-tr-none' 
                  : 'bg-slate-700/50 text-slate-200 rounded-tl-none'
              }`}>
                <p className="text-xs font-bold mb-1 opacity-50">{t.role === 'user' ? 'Agent' : 'Customer (AI)'}</p>
                <p>{t.text}</p>
              </div>
            </div>
          ))}
          {editableResult.transcription.length === 0 && (
             <p className="text-slate-500 italic text-center">No transcript available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackReport;
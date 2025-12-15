import React from 'react';
import { EvaluationResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  result: EvaluationResult;
  onRestart: () => void;
}

const FeedbackReport: React.FC<Props> = ({ result, onRestart }) => {
  const chartData = [
    { name: 'Total Score', value: result.totalScore }
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
          <p className="text-slate-400 mt-1 text-lg">Agent: <span className="text-blue-400 font-semibold">{result.agentName}</span></p>
        </div>
        <button 
          onClick={onRestart}
          className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-white font-medium shadow-md"
        >
          Start New Session
        </button>
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
                        <Cell fill={getScoreColor(result.totalScore)} />
                    </Bar>
                </BarChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-5xl font-bold text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                     {result.totalScore}%
                 </span>
             </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="md:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider mb-2">Executive Summary</h3>
          <p className="text-lg text-slate-200 leading-relaxed">{result.summary}</p>
        </div>
      </div>

      {/* Detailed Scorecard Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-slate-400 font-medium uppercase tracking-wider">Detailed Scorecard</h3>
          <span className="text-xs text-slate-500">Based on uploaded criteria</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase">
                <th className="p-4 border-b border-slate-700 font-medium">Criterion</th>
                <th className="p-4 border-b border-slate-700 font-medium text-center w-32">Points</th>
                <th className="p-4 border-b border-slate-700 font-medium">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {result.criteriaBreakdown?.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 text-white font-medium">{item.name}</td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-lg font-bold ${
                        (item.score / item.maxPoints) === 1 ? 'text-green-400' : 
                        (item.score / item.maxPoints) >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {item.score}
                      </span>
                      <span className="text-xs text-slate-500">/ {item.maxPoints}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300 text-sm">{item.comment}</td>
                </tr>
              ))}
              {(!result.criteriaBreakdown || result.criteriaBreakdown.length === 0) && (
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
          {result.transcription.map((t, i) => (
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
          {result.transcription.length === 0 && (
             <p className="text-slate-500 italic text-center">No transcript available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackReport;
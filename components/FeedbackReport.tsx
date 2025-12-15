import React from 'react';
import { EvaluationResult } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  result: EvaluationResult;
  onRestart: () => void;
}

const FeedbackReport: React.FC<Props> = ({ result, onRestart }) => {
  const chartData = [
    { name: 'Score', value: result.score }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#4ade80'; // green-400
    if (score >= 70) return '#facc15'; // yellow-400
    return '#f87171'; // red-400
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in">
      <div className="flex justify-between items-center border-b border-slate-700 pb-6">
        <h1 className="text-3xl font-bold text-white">Evaluation Report</h1>
        <button 
          onClick={onRestart}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-white font-medium"
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
                        <Cell fill={getScoreColor(result.score)} />
                    </Bar>
                </BarChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-5xl font-bold text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                     {result.score}/100
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-green-900/30">
          <h3 className="flex items-center text-green-400 font-bold mb-4 uppercase tracking-wider">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Strengths
          </h3>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start text-slate-300">
                <span className="mr-2 text-green-500">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-red-900/30">
          <h3 className="flex items-center text-red-400 font-bold mb-4 uppercase tracking-wider">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Areas for Improvement
          </h3>
          <ul className="space-y-2">
            {result.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start text-slate-300">
                <span className="mr-2 text-red-500">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Transcript Accordion */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
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

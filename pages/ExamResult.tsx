import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { ExamAttempt, Exam } from '../types';

const ExamResult: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResult = async () => {
      setLoading(true);
      if (id) {
        const a = await db.getAttempt(id);
        if (a) {
          setAttempt(a);
          const e = await db.getExam(a.examId);
          if (e) setExam(e);
        }
      }
      setLoading(false);
    };
    loadResult();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading Cloud Results...</div>;
  if (!attempt || !exam) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Result not found</div>;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden text-center p-12 transition-colors">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Exam Results</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">{exam.title}</p>
        </div>

        <div className="flex justify-center mb-8">
           <div className={`w-40 h-40 rounded-full flex items-center justify-center border-8 ${attempt.score! >= 70 ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-red-500 text-red-600 dark:text-red-400'}`}>
              <div className="text-center">
                 <div className="text-4xl font-bold">{attempt.score}%</div>
                 <div className="text-sm font-medium text-slate-400 dark:text-slate-500">Final Score</div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-b border-slate-100 dark:border-slate-800 py-6 mb-8">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{attempt.violations.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Violations</div>
          </div>
          <div>
             <div className="text-2xl font-bold text-slate-900 dark:text-white">{Math.floor((attempt.endTime! - attempt.startTime) / 60000)}m</div>
             <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Time Taken</div>
          </div>
          <div>
             <div className="text-2xl font-bold text-slate-900 dark:text-white">{attempt.answers.length}</div>
             <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Answered</div>
          </div>
        </div>

        {attempt.feedback && (
          <div className="text-left bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
              🤖 AI Grader Feedback
            </h3>
            <pre className="whitespace-pre-wrap text-sm text-indigo-800 dark:text-indigo-200 font-sans">{attempt.feedback}</pre>
          </div>
        )}

        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-slate-900 dark:bg-slate-800 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ExamResult;
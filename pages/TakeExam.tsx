import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { Exam, ExamAttempt, Answer, Violation, QuestionType, User } from '../types';
import { gradeShortAnswer } from '../services/geminiService';

interface TakeExamProps {
  user: User;
}

const TakeExam: React.FC<TakeExamProps> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Anti-cheat refs
  const hasLeftTab = useRef(false);

  // Load Exam
  useEffect(() => {
    const loadExam = async () => {
      if (id) {
        const e = await db.getExam(id);
        if (e) {
          setExam(e);
          setTimeLeft(e.durationMinutes * 60);
        } else {
          alert("Exam not found");
          navigate('/dashboard');
        }
      }
    };
    loadExam();
  }, [id, navigate]);

  // Webcam Setup
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera denied", err);
        alert("Camera permission is required for proctoring.");
      }
    };
    startCamera();
    return () => {
      // Cleanup stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Timer
  useEffect(() => {
    if (!exam || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, exam]);

  // Anti-Cheat: Visibility Change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hasLeftTab.current = true;
        setViolations(prev => [...prev, {
          timestamp: Date.now(),
          type: 'TAB_SWITCH',
          message: 'User switched tabs or minimized window'
        }]);
      }
    };

    const handleBlur = () => {
        setViolations(prev => [...prev, {
            timestamp: Date.now(),
            type: 'TAB_SWITCH',
            message: 'Window lost focus'
          }]);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Prevent Copy/Paste
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('copy', preventDefault);
    document.addEventListener('paste', preventDefault);
    document.addEventListener('contextmenu', preventDefault);
    return () => {
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('paste', preventDefault);
      document.removeEventListener('contextmenu', preventDefault);
    };
  }, []);

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const calculateScore = async (finalAnswers: Record<string, string>): Promise<{score: number, feedback: string}> => {
    if (!exam) return { score: 0, feedback: '' };

    let totalPoints = 0;
    let earnedPoints = 0;
    let feedbackSummary = '';

    for (const q of exam.questions) {
      totalPoints += q.points;
      const response = finalAnswers[q.id] || '';

      if (q.type === QuestionType.MCQ) {
        if (response === q.correctAnswer) {
          earnedPoints += q.points;
        }
      } else if (q.type === QuestionType.SHORT_ANSWER) {
        // AI Grading
        const grade = await gradeShortAnswer(q.text, response, q.modelAnswer || '', q.points);
        earnedPoints += grade.score;
        feedbackSummary += `Q: ${q.text.substring(0, 20)}... AI Feedback: ${grade.feedback}\n`;
      }
    }

    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    return { score: percentage, feedback: feedbackSummary };
  };

  const handleSubmit = useCallback(async (auto: boolean = false) => {
    if (!exam) return;
    setIsSubmitting(true);

    const { score, feedback } = await calculateScore(answers);

    const attempt: ExamAttempt = {
      id: `att-${Date.now()}`,
      examId: exam.id,
      studentId: user.id,
      startTime: Date.now() - ((exam.durationMinutes * 60) - timeLeft) * 1000,
      endTime: Date.now(),
      answers: Object.entries(answers).map(([qid, resp]) => ({ questionId: qid, response: resp as string })),
      violations: violations,
      score,
      feedback,
      status: 'GRADED'
    };

    await db.saveAttempt(attempt);
    setIsSubmitting(false);
    navigate(`/result/${attempt.id}`);
  }, [exam, answers, violations, user.id, timeLeft, navigate]);

  if (!exam) return <div className="p-8 text-center">Loading Exam...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Exam Header */}
      <header className="bg-slate-900 text-white py-4 px-6 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">{exam.title}</h1>
            <p className="text-xs text-slate-400">Question {Object.keys(answers).length}/{exam.questions.length} Answered</p>
          </div>
          <div className={`text-2xl font-mono font-bold ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-8">
        {/* Main Question Area */}
        <div className="flex-1 space-y-8">
           {exam.questions.map((q, idx) => (
             <div key={q.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex gap-4">
                  <span className="text-slate-400 font-bold text-lg select-none">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="text-lg text-slate-900 font-medium mb-4 select-none">{q.text}</p>
                    
                    {q.type === QuestionType.MCQ ? (
                      <div className="space-y-3">
                        {q.options?.map((opt) => (
                          <label key={opt} className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors group">
                            <input 
                              type="radio" 
                              name={q.id} 
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-slate-700 group-hover:text-slate-900 select-none">{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea 
                        value={answers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-4 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-y"
                        placeholder="Type your answer here..."
                        spellCheck={false}
                      />
                    )}
                    <div className="mt-2 text-right text-xs text-slate-400 font-medium select-none">{q.points} Points</div>
                  </div>
                </div>
             </div>
           ))}

           <div className="flex justify-end pt-8 pb-20">
             <button 
               onClick={() => handleSubmit(false)}
               disabled={isSubmitting}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 disabled:opacity-70"
             >
               {isSubmitting ? 'Submitting & Grading...' : 'Submit Exam'}
             </button>
           </div>
        </div>

        {/* Sidebar: Proctoring & Status */}
        <div className="hidden lg:block w-72 shrink-0 space-y-6">
           <div className="bg-black rounded-xl overflow-hidden shadow-lg border-2 border-slate-800 relative">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-48 object-cover opacity-90" />
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                 REC
              </div>
              <div className="p-3 bg-slate-900 text-slate-300 text-xs text-center">
                 Proctoring Active
              </div>
           </div>

           <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-bold text-yellow-800 mb-2 text-sm">⚠️ Anti-Cheat Active</h3>
              <ul className="text-xs text-yellow-700 space-y-1 list-disc pl-4">
                <li>Tab switching is monitored.</li>
                <li>Copy/Paste is disabled.</li>
                <li>Face detection is on.</li>
              </ul>
              {violations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <div className="text-red-600 font-bold text-xs">Violations Detected: {violations.length}</div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default TakeExam;
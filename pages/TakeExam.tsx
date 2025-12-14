import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { Exam, ExamAttempt, Violation, QuestionType, User } from '../types';
import { gradeShortAnswer } from '../services/geminiService';

interface TakeExamProps {
  user: User;
}

const MAX_VIOLATIONS = 4;

const TakeExam: React.FC<TakeExamProps> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasLeftTab = useRef(false);
  const lastViolationTime = useRef(0);

  useEffect(() => {
    const loadExam = async () => {
      if (id) {
        const e = await db.getExam(id);
        if (e) {
            // Check Scheduling
            const now = new Date();
            const start = e.startDate ? new Date(e.startDate) : new Date(0);
            const end = e.endDate ? new Date(e.endDate) : new Date(8640000000000000);

            if (now < start || now > end) {
                alert("This exam is currently unavailable due to scheduling restrictions.");
                navigate('/dashboard');
                return;
            }

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

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!exam || !isStarted || timeLeft <= 0) return;
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
  }, [timeLeft, exam, isStarted]);

  const logViolation = (message: string, type: Violation['type'] = 'TAB_SWITCH') => {
      const now = Date.now();
      if (now - lastViolationTime.current < 1000) return;
      lastViolationTime.current = now;
      hasLeftTab.current = true;
      setViolations(prev => [...prev, { timestamp: now, type: type, message: message }]);
  };

  useEffect(() => {
    if (!isStarted) return;
    const handleVisibilityChange = () => { if (document.hidden) logViolation('User switched tabs'); };
    const handleBlur = () => { logViolation('Window lost focus'); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isStarted]);

  useEffect(() => {
    if (!isStarted) return;
    const handleFullScreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) logViolation('Exited Full Screen', 'FULLSCREEN_EXIT');
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, [isStarted]);

  useEffect(() => {
    if (!isStarted) return;
    window.history.pushState(null, document.title, window.location.href);
    const handlePopState = () => window.history.pushState(null, document.title, window.location.href);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isStarted]);

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

  const startExam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        // @ts-ignore
        if (navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(['Escape']);
      } catch (fsErr) {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        throw new Error("Full Screen permission denied");
      }
      setIsStarted(true);
    } catch (e: any) {
      let msg = "Start Failed. Requirements not met.";
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') msg = "🚫 CAMERA BLOCKED. Please enable camera permissions.";
      else if (e.message.includes("Full Screen")) msg = "🚫 FULL SCREEN REQUIRED.";
      alert(msg);
    }
  };

  useEffect(() => {
    if (isStarted && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [isStarted, isFullscreen]);

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
        if (response === q.correctAnswer) earnedPoints += q.points;
      } else if (q.type === QuestionType.SHORT_ANSWER) {
        const grade = await gradeShortAnswer(q.text, response, q.modelAnswer || '', q.points);
        earnedPoints += grade.score;
        feedbackSummary += `Q: ${q.text.substring(0, 20)}... AI Feedback: ${grade.feedback}\n`;
      }
    }
    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    return { score: percentage, feedback: feedbackSummary };
  };

  const handleSubmit = useCallback(async (auto: boolean = false, disqualified: boolean = false) => {
    if (!exam) return;
    setIsSubmitting(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(e => console.error(e));
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    let score = 0;
    let feedback = "";
    if (disqualified) {
      score = 0;
      feedback = "⚠️ DISQUALIFIED due to violations.";
    } else {
      const result = await calculateScore(answers);
      score = result.score;
      feedback = result.feedback;
    }
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

  useEffect(() => {
    if (violations.length > MAX_VIOLATIONS && !isSubmitting) handleSubmit(true, true);
  }, [violations, isSubmitting, handleSubmit]);

  if (!exam) return <div className="p-8 text-center">Loading Exam...</div>;
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-3xl p-8 text-center space-y-6 shadow-2xl border-4 border-white/10 relative overflow-hidden">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold mb-4 shadow-inner">
            ⚡
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{exam.title}</h1>
          <div className="text-left bg-slate-50 p-5 rounded-2xl border border-slate-200 text-sm space-y-3 text-slate-600">
            <p className="font-bold text-slate-900 uppercase tracking-wide text-xs">Security Protocols</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Proctored session (Camera Active)</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Fullscreen Required</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>No Tab Switching allowed</li>
            </ul>
          </div>
          <button onClick={startExam} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-200 transition-transform hover:scale-[1.02]">
            Begin Assessment
          </button>
        </div>
      </div>
    );
  }

  if (!isFullscreen && !isSubmitting) {
    return (
      <div className="fixed inset-0 z-[100] bg-red-950 flex flex-col items-center justify-center text-center p-8 text-white backdrop-blur-xl">
        <div className="text-6xl mb-6 animate-pulse">⚠️</div>
        <h1 className="text-4xl font-black mb-4 tracking-tighter">SECURITY VIOLATION</h1>
        <p className="text-xl mb-8 max-w-xl text-red-200">Fullscreen mode exited. Return immediately to avoid disqualification.</p>
        <button onClick={() => document.documentElement.requestFullscreen().catch(e => console.error(e))} className="bg-white text-red-900 px-8 py-3 rounded-full font-bold text-lg shadow-2xl hover:bg-red-50">
          Return to Exam
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 py-3 px-6 sticky top-0 z-40 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{exam.title}</h1>
          <div className="w-full bg-slate-100 h-1 mt-1 rounded-full overflow-hidden">
             <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${(Object.keys(answers).length / exam.questions.length) * 100}%` }}></div>
          </div>
        </div>
        <div className={`text-xl font-mono font-bold px-4 py-1.5 rounded-lg border ${timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
          {formatTime(timeLeft)}
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-8">
        <div className="flex-1 space-y-6">
           {exam.questions.map((q, idx) => (
             <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex gap-5">
                  <span className="text-slate-300 font-bold text-2xl select-none">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-xl text-slate-800 font-medium mb-6 select-none leading-relaxed">{q.text}</p>
                    {q.type === QuestionType.MCQ ? (
                      <div className="grid gap-3">
                        {q.options?.map((opt) => (
                          <label key={opt} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all group ${answers[q.id] === opt ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${answers[q.id] === opt ? 'border-indigo-600' : 'border-slate-300'}`}>
                               {answers[q.id] === opt && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                            </div>
                            <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={(e) => handleAnswerChange(q.id, e.target.value)} className="hidden" />
                            <span className={`text-lg select-none ${answers[q.id] === opt ? 'text-indigo-900 font-medium' : 'text-slate-600'}`}>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea value={answers[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} className="w-full border border-slate-300 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-y text-lg" placeholder="Type your answer..." spellCheck={false} />
                    )}
                  </div>
                </div>
             </div>
           ))}
           <div className="flex justify-end pt-4 pb-20">
             <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-bold shadow-xl shadow-indigo-200 transition-transform hover:-translate-y-1 text-lg disabled:opacity-70">
               {isSubmitting ? 'Submitting...' : 'Complete & Submit'}
             </button>
           </div>
        </div>

        <div className="hidden lg:block w-80 shrink-0 space-y-6">
           <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-900 relative group">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-56 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full">
                 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                 <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live Feed</span>
              </div>
           </div>
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Session Status</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Violations</span>
                    <span className={`font-bold ${violations.length > 0 ? 'text-red-500' : 'text-green-500'}`}>{violations.length} / {MAX_VIOLATIONS}</span>
                 </div>
                 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full transition-all" style={{ width: `${(violations.length / MAX_VIOLATIONS) * 100}%` }}></div>
                 </div>
                 <ul className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-100">
                    <li className="flex items-center gap-2">✓ Fullscreen Active</li>
                    <li className="flex items-center gap-2">✓ Audio/Video Sync</li>
                 </ul>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TakeExam;
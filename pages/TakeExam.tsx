import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { Exam, ExamAttempt, Answer, Violation, QuestionType, User } from '../types';
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
  const [isFullscreen, setIsFullscreen] = useState(false); // Track state for UI overlay
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // Store stream independently of UI
  
  // Anti-cheat refs
  const hasLeftTab = useRef(false);
  const lastViolationTime = useRef(0);

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

  // Cleanup Camera on Unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Timer - Only runs if isStarted is true
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

  // --- Anti-Cheat Logic ---

  const logViolation = (message: string, type: Violation['type'] = 'TAB_SWITCH') => {
      const now = Date.now();
      // Debounce: Ignore violations if they happen within 1 second of each other
      if (now - lastViolationTime.current < 1000) return;
      
      lastViolationTime.current = now;
      hasLeftTab.current = true;
      
      setViolations(prev => [...prev, {
        timestamp: now,
        type: type,
        message: message
      }]);
  };

  // 1. Tab Switching / Blur
  useEffect(() => {
    if (!isStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('User switched tabs or minimized window');
      }
    };

    const handleBlur = () => {
        logViolation('Window lost focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isStarted]);

  // 2. Full Screen Enforcement
  useEffect(() => {
    if (!isStarted) return;

    const handleFullScreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        logViolation('User exited Full Screen mode', 'FULLSCREEN_EXIT');
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, [isStarted]);

  // 3. Disable Back Button & Navigation
  useEffect(() => {
    if (!isStarted) return;

    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      window.history.pushState(null, document.title, window.location.href);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; 
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isStarted]);

  // 4. Prevent Copy/Paste/Context Menu
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

  // --- Strict Start Logic ---
  const startExam = async () => {
    try {
      // 1. Request Camera Permission strictly FIRST
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream; // Store it

      // 2. Request Full Screen
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        
        // 3. Try to Lock Keyboard (Chrome/Edge only) to prevent Escape
        // @ts-ignore
        if (navigator.keyboard && navigator.keyboard.lock) {
            // @ts-ignore
            await navigator.keyboard.lock(['Escape']);
        }
      } catch (fsErr) {
        // If fullscreen fails, stop camera and block entry
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        throw new Error("Full Screen permission denied");
      }

      // 4. Activate Exam UI
      setIsStarted(true);
      
    } catch (e: any) {
      console.error("Start blocked:", e);
      let msg = "Start Failed. Requirements not met.";
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = "🚫 CAMERA BLOCKED: You cannot take this exam without camera access. Please enable camera permissions in your browser settings and try again.";
      } else if (e.message.includes("Full Screen")) {
        msg = "🚫 FULL SCREEN REQUIRED: You must allow Full Screen mode to take this exam.";
      }
      alert(msg);
    }
  };

  // Attach Camera stream to Video Element once UI is rendered
  useEffect(() => {
    if (isStarted && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isStarted]);


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

  const handleSubmit = useCallback(async (auto: boolean = false, disqualified: boolean = false) => {
    if (!exam) return;
    setIsSubmitting(true);

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.error(e));
    }
    
    // Stop Camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    let score = 0;
    let feedback = "";

    if (disqualified) {
      score = 0;
      feedback = "⚠️ DISQUALIFIED: You exceeded the maximum allowed violations (Tab switching/Full Screen Exit). Your exam has been automatically submitted with a score of 0.";
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

  // Monitor violations threshold
  useEffect(() => {
    if (violations.length > MAX_VIOLATIONS && !isSubmitting) {
      handleSubmit(true, true);
    }
  }, [violations, isSubmitting, handleSubmit]);

  if (!exam) return <div className="p-8 text-center">Loading Exam...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- Start Screen Overlay ---
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
          <div className="text-left bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-2 text-slate-600">
            <p className="font-bold text-slate-800">Exam Rules:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>This exam is <strong>Proctored</strong>. Your camera will be active.</li>
              <li>The window will go into <strong>Full Screen</strong> mode.</li>
              <li>Do <strong>NOT</strong> switch tabs or exit full screen.</li>
              <li>Violations {MAX_VIOLATIONS} will result in <strong>Automatic Disqualification (Score 0)</strong>.</li>
            </ul>
          </div>
          <button 
            onClick={startExam}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-transform hover:scale-105"
          >
            I Agree & Begin Exam
          </button>
        </div>
      </div>
    );
  }

  // --- Blocking Overlay for Fullscreen Exit ---
  if (!isFullscreen && !isSubmitting) {
    return (
      <div className="fixed inset-0 z-[100] bg-red-900 flex flex-col items-center justify-center text-center p-8 text-white">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-4xl font-bold mb-4">EXAM INTERRUPTED</h1>
        <p className="text-xl mb-8 max-w-xl">
          You have exited Full Screen mode. This is a security violation.
          You cannot continue the exam unless you are in Full Screen.
        </p>
        <button 
          onClick={() => {
            document.documentElement.requestFullscreen().catch(e => console.error(e));
          }}
          className="bg-white text-red-900 px-8 py-3 rounded-lg font-bold text-lg shadow-lg hover:bg-red-50 transition-colors"
        >
          Return to Exam
        </button>
      </div>
    );
  }

  // --- Main Exam UI ---

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
                <li>Full Screen Enforced.</li>
                <li>Tab switching monitored.</li>
                <li>Limit: <span className="font-bold text-red-600">{MAX_VIOLATIONS} Violations</span> max.</li>
                <li>Copy/Paste disabled.</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-yellow-200">
                <div className={`font-bold text-xs flex justify-between items-center ${violations.length > MAX_VIOLATIONS ? 'text-red-700' : 'text-slate-700'}`}>
                   <span>Violations Detected:</span>
                   <span className="text-lg">{violations.length} <span className="text-xs text-slate-400">/ {MAX_VIOLATIONS}</span></span>
                </div>
                {violations.length > 2 && (
                  <p className="text-[10px] text-red-600 mt-1 font-semibold animate-pulse">
                    Warning: Approaching limit!
                  </p>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TakeExam;
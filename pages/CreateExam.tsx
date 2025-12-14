import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { generateExamQuestions } from '../services/geminiService';
import { Question, QuestionType, Exam, User } from '../types';

const CreateExam: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); 
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Exam Meta
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // AI State
  const [topic, setTopic] = useState('');
  
  // Manual Question State
  const [manualType, setManualType] = useState<QuestionType>(QuestionType.MCQ);
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(5);
  const [manualOptions, setManualOptions] = useState<string[]>(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState(''); 
  const [manualModel, setManualModel] = useState('');

  // Master List
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (id) {
      const loadExam = async () => {
        setLoading(true);
        const exam = await db.getExam(id);
        if (exam) {
          if (exam.instructorId !== user.id) {
            alert("Unauthorized");
            navigate('/dashboard');
            return;
          }
          setTitle(exam.title);
          setDescription(exam.description);
          setDuration(exam.durationMinutes);
          setQuestions(exam.questions);
          if (exam.startDate) setStartDate(exam.startDate);
          if (exam.endDate) setEndDate(exam.endDate);
        } else {
          alert("Exam not found");
          navigate('/dashboard');
        }
        setLoading(false);
      };
      loadExam();
    }
  }, [id, user.id, navigate]);

  const handleGenerate = async () => {
    if (!topic) return alert("Please enter a topic for AI generation");
    setLoading(true);
    try {
      const generated = await generateExamQuestions(topic, 5);
      setQuestions([...questions, ...generated]);
    } catch (e) {
      alert("Failed to generate questions. Check API Key.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = () => {
    if (!manualText) return alert("Question text is required");
    
    const newQ: Question = {
      id: `man_${Date.now()}`,
      text: manualText,
      type: manualType,
      points: manualPoints,
      options: manualType === QuestionType.MCQ ? manualOptions.filter(o => o.trim() !== '') : [],
      correctAnswer: manualType === QuestionType.MCQ ? manualCorrect : undefined,
      modelAnswer: manualType === QuestionType.SHORT_ANSWER ? manualModel : undefined
    };

    if (manualType === QuestionType.MCQ && newQ.options!.length < 2) {
      return alert("MCQ must have at least 2 options");
    }
    if (manualType === QuestionType.MCQ && !manualCorrect) {
      return alert("Select a correct answer for MCQ");
    }

    setQuestions([...questions, newQ]);
    
    // Reset Manual Form
    setManualText('');
    setManualOptions(['', '', '', '']);
    setManualCorrect('');
    setManualModel('');
    setManualPoints(5);
  };

  const handleOptionChange = (idx: number, val: string) => {
    const newOpts = [...manualOptions];
    newOpts[idx] = val;
    setManualOptions(newOpts);
  };

  const handleSave = async () => {
    if (!title || questions.length === 0) return alert("Title and questions are required");
    
    // Basic date validation
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return alert("Start date cannot be after end date");
    }

    setSaving(true);
    const newExam: Exam = {
      id: id ? id : `exam-${Date.now()}`,
      title,
      description,
      durationMinutes: duration,
      instructorId: user.id,
      questions,
      createdAt: new Date().toISOString(),
      isPublished: true,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };
    
    await db.createExam(newExam);
    setSaving(false);
    navigate('/dashboard');
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  if (loading && id) return <div className="flex h-[50vh] items-center justify-center text-slate-500 dark:text-slate-400 font-medium">Fetching Exam Details...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{id ? 'Edit Examination' : 'Create New Exam'}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Design your assessment using AI or manual inputs.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? 'Saving...' : (id ? 'Update Changes' : 'Publish Now')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Exam Configuration</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Exam Title</label>
            <input 
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
              placeholder="e.g. Advanced Calculus Midterm Spring 2024"
            />
          </div>
          <div className="space-y-2">
             <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Duration (Min)</label>
             <input 
              type="number"
              value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
             />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Available From (Optional)</label>
                <input 
                    type="datetime-local"
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-600 dark:text-slate-300"
                />
                <p className="text-xs text-slate-400">Students cannot start before this time.</p>
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Deadline (Optional)</label>
                <input 
                    type="datetime-local"
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-600 dark:text-slate-300"
                />
                <p className="text-xs text-slate-400">Exam closes automatically after this time.</p>
            </div>
        </div>

        <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Description / Instructions</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none transition-shadow"
              placeholder="Brief instructions for students..."
            />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* AI Generator Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-3xl shadow-xl text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-white/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 p-1.5 rounded-lg text-lg">✨</span>
              <label className="text-lg font-bold">AI Question Generator</label>
            </div>
            <p className="text-indigo-100 text-sm mb-6">Instantly generate structured questions on any topic using Google Gemini.</p>
            
            <div className="space-y-3">
               <input 
                 value={topic} onChange={e => setTopic(e.target.value)}
                 className="w-full bg-white/10 border border-white/20 text-white placeholder-indigo-200 rounded-xl px-4 py-3 focus:bg-white/20 focus:ring-2 focus:ring-white/50 outline-none transition-all"
                 placeholder="Enter a topic (e.g. 'Thermodynamics')"
               />
               <button 
                 onClick={handleGenerate}
                 disabled={loading}
                 className="w-full bg-white text-indigo-700 px-4 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors disabled:opacity-70"
               >
                 {loading ? 'Generating Content...' : 'Auto-Generate Questions'}
               </button>
            </div>
          </div>
        </div>

        {/* Manual Builder Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
           <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
             <label className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
               <span>🛠️</span> Manual Question Builder
             </label>
           </div>
           
           <div className="space-y-4">
             <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
               <button 
                onClick={() => setManualType(QuestionType.MCQ)}
                className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${manualType === QuestionType.MCQ ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >Multiple Choice</button>
               <button 
                onClick={() => setManualType(QuestionType.SHORT_ANSWER)}
                className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${manualType === QuestionType.SHORT_ANSWER ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
               >Short Answer</button>
             </div>
             
             <textarea 
               value={manualText} onChange={e => setManualText(e.target.value)}
               className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-400 dark:text-white focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all"
               placeholder="Type your question here..."
               rows={2}
             />

             {manualType === QuestionType.MCQ && (
               <div className="space-y-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                 <div className="text-xs font-bold text-slate-400 uppercase mb-2">Options (Select Correct)</div>
                 {manualOptions.map((opt, i) => (
                   <div key={i} className="flex gap-2 items-center">
                     <input 
                       type="radio" name="manualCorrect" 
                       checked={manualCorrect === opt && opt !== ''}
                       onChange={() => setManualCorrect(opt)}
                       disabled={!opt}
                       className="w-4 h-4 text-indigo-600"
                     />
                     <input 
                       value={opt} onChange={e => handleOptionChange(i, e.target.value)}
                       className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
                       placeholder={`Option ${i+1}`}
                     />
                   </div>
                 ))}
               </div>
             )}

             {manualType === QuestionType.SHORT_ANSWER && (
               <input 
                  value={manualModel} onChange={e => setManualModel(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 dark:text-white"
                  placeholder="Model Answer (for AI grading)..."
               />
             )}
             
             <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      value={manualPoints} onChange={e => setManualPoints(Number(e.target.value))}
                      className="w-16 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-center font-bold text-sm"
                    />
                    <span className="text-xs text-slate-400 font-bold uppercase">Points</span>
                </div>
                <button 
                  onClick={handleAddManual}
                  className="bg-slate-900 dark:bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-sm"
                >
                  + Add Question
                </button>
             </div>
           </div>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
           <h2 className="text-xl font-bold text-slate-900 dark:text-white">Questions Queue</h2>
           <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md text-xs font-bold">{questions.length}</span>
        </div>
        
        {questions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-slate-400 font-medium">Your exam is empty. Add questions above.</p>
          </div>
        )}

        <div className="grid gap-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white dark:bg-slate-900 px-6 pb-6 pt-10 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative group transition-all hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md">
              <div className="absolute top-4 right-4 flex gap-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wide pt-1.5 mr-2">{q.type.replace('_', ' ')}</span>
                 <button 
                  onClick={() => removeQuestion(q.id)}
                  className="text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              <div className="flex gap-4">
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-3">{q.text}</h3>
                  
                  {q.type === QuestionType.MCQ && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options?.map((opt, i) => (
                        <div key={i} className={`text-sm px-4 py-3 rounded-xl border flex items-center gap-3 ${opt === q.correctAnswer ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <div className={`w-3 h-3 rounded-full border ${opt === q.correctAnswer ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}`}></div>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === QuestionType.SHORT_ANSWER && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 mt-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1 block">Expected Model Answer</span>
                      <p className="text-sm text-emerald-800 dark:text-emerald-300">{q.modelAnswer}</p>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{q.points} PTS</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateExam;
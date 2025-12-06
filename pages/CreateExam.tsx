
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { generateExamQuestions } from '../services/geminiService';
import { Question, QuestionType, Exam, User } from '../types';

const CreateExam: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // Check for ID param
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Exam Meta
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  
  // AI State
  const [topic, setTopic] = useState('');
  
  // Manual Question State
  const [manualType, setManualType] = useState<QuestionType>(QuestionType.MCQ);
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(5);
  const [manualOptions, setManualOptions] = useState<string[]>(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState(''); // Index or Value
  const [manualModel, setManualModel] = useState('');

  // Master List
  const [questions, setQuestions] = useState<Question[]>([]);

  // Load existing exam if editing
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
    
    setSaving(true);
    const newExam: Exam = {
      // If editing, preserve ID, else generate new
      id: id ? id : `exam-${Date.now()}`,
      title,
      description,
      durationMinutes: duration,
      instructorId: user.id,
      questions,
      createdAt: new Date().toISOString(),
      isPublished: true
    };
    
    await db.createExam(newExam); // Acts as update if ID exists
    setSaving(false);
    navigate('/dashboard');
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  if (loading && id) return <div className="p-8 text-center">Loading Exam Data...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{id ? 'Edit Exam' : 'Create New Exam'}</h1>
        <p className="text-slate-500 mt-2">Configure exam details and add questions manually or via AI.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Exam Title</label>
            <input 
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="e.g. Advanced Calculus Midterm"
            />
          </div>
          <div className="space-y-2">
             <label className="block text-sm font-medium text-slate-700">Duration (Minutes)</label>
             <input 
              type="number"
              value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
             />
          </div>
        </div>
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea 
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
              placeholder="Instructions for students..."
            />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* AI Generator Section */}
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 space-y-4">
          <div>
            <label className="block text-sm font-bold text-indigo-900 mb-1">✨ AI Question Generator</label>
            <p className="text-xs text-indigo-700 mb-2">Auto-generate 5 questions based on a topic.</p>
            <input 
                value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. 'History of Rome'"
              />
          </div>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Questions'}
          </button>
        </div>

        {/* Manual Builder Section */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
           <div>
             <label className="block text-sm font-bold text-slate-800 mb-1">🛠️ Manual Question Builder</label>
             <div className="flex gap-2 mb-2">
               <button 
                onClick={() => setManualType(QuestionType.MCQ)}
                className={`flex-1 text-xs py-1 rounded border ${manualType === QuestionType.MCQ ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}
               >MCQ</button>
               <button 
                onClick={() => setManualType(QuestionType.SHORT_ANSWER)}
                className={`flex-1 text-xs py-1 rounded border ${manualType === QuestionType.SHORT_ANSWER ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}
               >Short Answer</button>
             </div>
             
             <textarea 
               value={manualText} onChange={e => setManualText(e.target.value)}
               className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none mb-2"
               placeholder="Enter question text..."
               rows={2}
             />

             {manualType === QuestionType.MCQ && (
               <div className="space-y-2">
                 <div className="text-xs font-semibold text-slate-500">Options (Select correct one)</div>
                 {manualOptions.map((opt, i) => (
                   <div key={i} className="flex gap-2 items-center">
                     <input 
                       type="radio" name="manualCorrect" 
                       checked={manualCorrect === opt && opt !== ''}
                       onChange={() => setManualCorrect(opt)}
                       disabled={!opt}
                     />
                     <input 
                       value={opt} onChange={e => handleOptionChange(i, e.target.value)}
                       className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                       placeholder={`Option ${i+1}`}
                     />
                   </div>
                 ))}
               </div>
             )}

             {manualType === QuestionType.SHORT_ANSWER && (
               <input 
                  value={manualModel} onChange={e => setManualModel(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="Model Answer (for AI grading)..."
               />
             )}
             
             <div className="flex items-center gap-2 mt-2">
                <input 
                  type="number"
                  value={manualPoints} onChange={e => setManualPoints(Number(e.target.value))}
                  className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                />
                <span className="text-xs text-slate-500">Points</span>
                <button 
                  onClick={handleAddManual}
                  className="ml-auto bg-slate-800 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-slate-900"
                >
                  Add
                </button>
             </div>
           </div>
        </div>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Questions ({questions.length})</h2>
        {questions.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
            No questions yet. Generate some or add manually!
          </div>
        )}
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white px-6 pb-6 pt-12 rounded-xl shadow-sm border border-slate-200 relative group transition-all hover:shadow-md">
            <button 
              onClick={() => removeQuestion(q.id)}
              className="absolute top-2 right-2 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-200 z-10"
            >
              Remove
            </button>
            <div className="flex items-start gap-4">
              <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                   <h3 className="font-medium text-slate-900 mb-2">{q.text}</h3>
                   <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded shrink-0 ml-4">{q.type}</span>
                </div>
                
                {q.type === QuestionType.MCQ && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {q.options?.map((opt, i) => (
                      <div key={i} className={`text-sm px-3 py-2 rounded border ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {q.type === QuestionType.SHORT_ANSWER && (
                  <div className="mt-2 text-sm text-slate-500 bg-slate-50 p-3 rounded italic">
                    <span className="font-semibold not-italic">Model Answer:</span> {q.modelAnswer}
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-400 font-medium">Points: {q.points}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-6">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
        >
          {saving ? 'Saving...' : (id ? 'Update Exam' : 'Publish Exam')}
        </button>
      </div>
    </div>
  );
};

export default CreateExam;

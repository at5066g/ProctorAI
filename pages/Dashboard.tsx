import React, { useEffect, useState } from 'react';
import { User, UserRole, Exam, ExamAttempt } from '../types';
import { db } from '../services/mockDatabase';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [filteredExams, setFilteredExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [instructorIdFilter, setInstructorIdFilter] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user.name);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const allExams = await db.getExams();
    setExams(allExams);
    
    if (user.role === UserRole.INSTRUCTOR) {
      setFilteredExams(allExams.filter(e => e.instructorId === user.id));
    } else {
      // Students see nothing until filtered
      setFilteredExams([]);
      const myAttempts = await db.getAttempts(user.id);
      setAttempts(myAttempts);
    }
    setLoading(false);
  };

  const handleJoinSection = () => {
    if (!instructorIdFilter) return;
    // Students can only see PUBLISHED exams
    const matches = exams.filter(e => e.instructorId === instructorIdFilter && e.isPublished);
    setFilteredExams(matches);
  };

  const handleNameUpdate = async () => {
    if (tempName.trim()) {
      const updatedUser = { ...user, name: tempName };
      await db.updateUser(updatedUser);
      setIsEditingName(false);
      window.location.reload(); 
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (window.confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
      try {
        await db.deleteExam(examId);
        fetchData();
      } catch (e) {
        alert("Failed to delete exam.");
      }
    }
  };

  const handleToggleStatus = async (exam: Exam) => {
    try {
      const newStatus = !exam.isPublished;
      await db.toggleExamPublishStatus(exam.id, newStatus);
      fetchData(); // Refresh list to show new status
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const getAttemptStatus = (examId: string) => {
    const attempt = attempts.find(a => a.examId === examId);
    if (!attempt) return null;
    return attempt;
  };

  if (loading) return <div className="p-8 text-center">Loading Cloud Data...</div>;

  return (
    <div className="space-y-8">
      {/* Profile / Identification Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
           <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-white text-xl ${user.role === UserRole.INSTRUCTOR ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
             {user.name.charAt(0)}
           </div>
           <div>
             <div className="flex items-center gap-2">
               {isEditingName ? (
                 <div className="flex items-center gap-2">
                   <input 
                     value={tempName}
                     onChange={(e) => setTempName(e.target.value)}
                     className="border border-slate-300 rounded px-2 py-1 text-sm"
                     autoFocus
                   />
                   <button onClick={handleNameUpdate} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Save</button>
                 </div>
               ) : (
                 <>
                   <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                   <button onClick={() => setIsEditingName(true)} className="text-xs text-slate-400 hover:text-indigo-600">
                     (Edit)
                   </button>
                 </>
               )}
             </div>
             <p className="text-slate-500 text-sm">{user.role} | ID: <span className="font-mono font-medium text-slate-700">{user.id}</span></p>
           </div>
        </div>

        {user.role === UserRole.INSTRUCTOR && (
          <div className="bg-indigo-50 px-6 py-3 rounded-lg border border-indigo-100 text-center">
             <p className="text-xs text-indigo-600 font-bold uppercase tracking-wide">Classroom Code</p>
             <p className="text-2xl font-mono font-bold text-indigo-900">{user.id}</p>
             <p className="text-xs text-indigo-400">Share this ID with students</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {user.role === UserRole.INSTRUCTOR ? 'My Class Exams' : 'Available Exams'}
        </h1>
        {user.role === UserRole.INSTRUCTOR && (
          <button
            onClick={() => navigate('/create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
          >
            + Create New Exam
          </button>
        )}
      </div>

      {/* Student Section Filter */}
      {user.role === UserRole.STUDENT && (
        <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
           <label className="block text-sm font-bold text-slate-700 mb-2">Find Your Section</label>
           <div className="flex gap-2 max-w-lg">
             <input 
               value={instructorIdFilter}
               onChange={(e) => setInstructorIdFilter(e.target.value)}
               placeholder="Enter Instructor ID (e.g. 201)"
               className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
             />
             <button 
               onClick={handleJoinSection}
               className="bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-900 transition-colors"
             >
               Find Exams
             </button>
           </div>
           <p className="text-xs text-slate-500 mt-2">
             Ask your instructor for their Classroom ID (e.g., Try <span className="font-mono font-bold">201</span> or <span className="font-mono font-bold">202</span>)
           </p>
        </div>
      )}

      {/* Exam Grid */}
      {filteredExams.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
           <p className="text-slate-400 text-lg">
             {user.role === UserRole.INSTRUCTOR 
               ? "You haven't created any exams yet." 
               : "No exams found. Enter a valid Instructor ID above to join a class."}
           </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredExams.map(exam => {
             const attempt = getAttemptStatus(exam.id);
             return (
              <div key={exam.id} className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow flex flex-col justify-between ${!exam.isPublished && user.role === UserRole.INSTRUCTOR ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      {user.role === UserRole.INSTRUCTOR && (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-2 inline-block ${exam.isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {exam.isPublished ? 'Active' : 'Disabled'}
                        </span>
                      )}
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">{exam.title}</h3>
                    </div>
                    {user.role === UserRole.INSTRUCTOR && (
                      <div className="flex flex-col gap-1 ml-2">
                        <div className="flex gap-1">
                          <button 
                            onClick={() => navigate(`/edit/${exam.id}`)}
                            className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteExam(exam.id)}
                            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                          >
                            Del
                          </button>
                        </div>
                        <button 
                          onClick={() => handleToggleStatus(exam)}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            exam.isPublished 
                              ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' 
                              : 'text-green-700 bg-green-100 hover:bg-green-200'
                          }`}
                        >
                          {exam.isPublished ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-3">{exam.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-sm text-slate-400 mb-4">
                    <span>{exam.questions.length} Qs</span>
                    <span>{exam.durationMinutes} m</span>
                  </div>
                  
                  {user.role === UserRole.STUDENT && (
                    <div className="mt-2">
                      {attempt ? (
                        <button
                          onClick={() => navigate(`/result/${attempt.id}`)}
                          className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-lg font-medium hover:bg-green-100 transition-colors"
                        >
                          View Results ({attempt.score}%)
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/exam/${exam.id}`)}
                          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Start Exam
                        </button>
                      )}
                    </div>
                  )}

                  {user.role === UserRole.INSTRUCTOR && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => navigate(`/instructor/exam/${exam.id}`)}
                        className="flex-1 bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-900 transition-colors text-sm"
                      >
                        View Attempts
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
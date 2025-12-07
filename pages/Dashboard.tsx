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
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(user.name);
  const [tempId, setTempId] = useState(user.id);
  const [tempPassword, setTempPassword] = useState('');
  
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
      setFilteredExams([]);
      const myAttempts = await db.getAttempts(user.id);
      setAttempts(myAttempts);
    }
    setLoading(false);
  };

  const handleJoinSection = () => {
    if (!instructorIdFilter) return;
    const matches = exams.filter(e => e.instructorId === instructorIdFilter && e.isPublished);
    setFilteredExams(matches);
  };

  const handleProfileUpdate = async () => {
    if (!tempName.trim()) return alert("Name cannot be empty");
    if (!tempId.trim()) return alert("ID cannot be empty");

    try {
      let targetId = user.id;

      if (tempId !== user.id) {
        if (!window.confirm("Changing your ID will migrate all your data. Continue?")) {
            return;
        }
        await db.updateUserId(user.id, tempId, user.role, { name: tempName });
        targetId = tempId;
      } else if (tempName !== user.name) {
        await db.updateUser({ ...user, name: tempName });
      }

      if (tempPassword.trim()) {
         await db.updatePassword(targetId, tempPassword);
         alert("Profile and Password updated successfully!");
      } else {
         alert("Profile updated successfully!");
      }
      
      setIsEditingProfile(false);
      setTempPassword('');
      window.location.reload();
    } catch (e: any) {
      alert("Failed to update profile: " + e.message);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (window.confirm("Are you sure you want to delete this exam?")) {
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
      fetchData();
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const getAttemptStatus = (examId: string) => {
    const attempt = attempts.find(a => a.examId === examId);
    if (!attempt) return null;
    return attempt;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-500 font-medium">Syncing with cloud...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
        
        <div className="flex items-start gap-6 relative z-10 w-full md:w-auto">
           <div className={`h-16 w-16 shrink-0 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br ${user.role === UserRole.INSTRUCTOR ? 'from-indigo-500 to-purple-600' : 'from-emerald-400 to-teal-600'}`}>
             {user.name.charAt(0)}
           </div>
           
           <div className="w-full">
             {isEditingProfile ? (
                 <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm w-full max-w-md animate-scale-in">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Edit Profile</h3>
                      <button onClick={() => setIsEditingProfile(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                   </div>
                   
                   <div className="grid gap-4">
                     <div>
                       <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Display Name</label>
                       <input 
                         value={tempName}
                         onChange={(e) => setTempName(e.target.value)}
                         className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                     </div>
                     <div>
                       <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">User ID (Unique)</label>
                       <input 
                         value={tempId}
                         onChange={(e) => setTempId(e.target.value)}
                         className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                       />
                     </div>
                     <div>
                       <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">New Password</label>
                       <input 
                         type="password"
                         value={tempPassword}
                         onChange={(e) => setTempPassword(e.target.value)}
                         placeholder="Leave blank to keep"
                         className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                     </div>
                     <button onClick={handleProfileUpdate} className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium text-sm transition-colors">
                       Save Changes
                     </button>
                   </div>
                 </div>
               ) : (
                 <>
                   <div className="flex flex-col">
                     <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                     <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${user.role === UserRole.INSTRUCTOR ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {user.role}
                        </span>
                        <span className="text-slate-400 text-sm">|</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">ID:</span>
                          <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-sm">{user.id}</span>
                        </div>
                     </div>
                     <button onClick={() => setIsEditingProfile(true)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 w-fit group">
                       <span>Edit Profile Settings</span>
                       <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                     </button>
                   </div>
                 </>
               )}
           </div>
        </div>

        {user.role === UserRole.INSTRUCTOR && !isEditingProfile && (
          <div className="bg-indigo-600/5 border border-indigo-100 p-5 rounded-2xl flex flex-col items-center justify-center min-w-[200px] relative z-10">
             <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Classroom Code</span>
             <span className="text-3xl font-mono font-bold text-indigo-700 tracking-tight">{user.id}</span>
             <span className="text-[10px] text-indigo-400 mt-1">Share with your students</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          {user.role === UserRole.INSTRUCTOR ? 'Managed Exams' : 'Available Assessments'}
        </h1>
        {user.role === UserRole.INSTRUCTOR && (
          <button
            onClick={() => navigate('/create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span>+</span> Create Exam
          </button>
        )}
      </div>

      {/* Student Section Filter */}
      {user.role === UserRole.STUDENT && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-6">
           <div>
             <h3 className="text-lg font-bold mb-1">Find Your Class Section</h3>
             <p className="text-slate-300 text-sm">Enter the unique Instructor ID provided by your professor.</p>
           </div>
           <div className="flex w-full md:w-auto gap-2">
             <input 
               value={instructorIdFilter}
               onChange={(e) => setInstructorIdFilter(e.target.value)}
               placeholder="Instructor ID (e.g. 201)"
               className="flex-1 md:w-64 bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-xl px-4 py-2.5 focus:bg-white/20 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
             />
             <button 
               onClick={handleJoinSection}
               className="bg-white text-slate-900 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
             >
               Search
             </button>
           </div>
        </div>
      )}

      {/* Exam Grid */}
      {filteredExams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
           <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-3xl">📂</div>
           <h3 className="text-slate-900 font-bold text-lg">No exams found</h3>
           <p className="text-slate-500 max-w-xs text-center mt-1">
             {user.role === UserRole.INSTRUCTOR 
               ? "Get started by creating your first exam using the button above." 
               : "Enter a valid Instructor ID to view available exams."}
           </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredExams.map(exam => {
             const attempt = getAttemptStatus(exam.id);
             return (
              <div key={exam.id} className={`group bg-white rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border ${!exam.isPublished && user.role === UserRole.INSTRUCTOR ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 shadow-sm'}`}>
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 pr-4">
                        {user.role === UserRole.INSTRUCTOR && (
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md mb-2 inline-block tracking-wide ${exam.isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {exam.isPublished ? '● Active' : '○ Draft'}
                          </span>
                        )}
                        <h3 className="font-bold text-lg text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{exam.title}</h3>
                      </div>
                      
                      {user.role === UserRole.INSTRUCTOR && (
                        <div className="flex flex-col gap-2">
                           <div className="flex bg-slate-100 rounded-lg p-1">
                             <button onClick={() => navigate(`/edit/${exam.id}`)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-md transition-all" title="Edit">✎</button>
                             <button onClick={() => handleDeleteExam(exam.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded-md transition-all" title="Delete">🗑</button>
                           </div>
                           <button 
                             onClick={() => handleToggleStatus(exam)}
                             className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                               exam.isPublished 
                                 ? 'text-amber-600 border-amber-200 hover:bg-amber-50' 
                                 : 'text-green-600 border-green-200 hover:bg-green-50'
                             }`}
                           >
                             {exam.isPublished ? 'Unpublish' : 'Publish'}
                           </button>
                        </div>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm line-clamp-2 mb-6 h-10">{exam.description}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mb-5">
                      <span className="flex items-center gap-1">
                         <span className="text-slate-300">⏱</span> {exam.durationMinutes} mins
                      </span>
                      <span className="flex items-center gap-1">
                         <span className="text-slate-300">📝</span> {exam.questions.length} Qs
                      </span>
                    </div>
                    
                    {user.role === UserRole.STUDENT && (
                      <div className="mt-2">
                        {attempt ? (
                          <button
                            onClick={() => navigate(`/result/${attempt.id}`)}
                            className={`w-full py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                              attempt.score! >= 70 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                          >
                            <span>{attempt.score}%</span>
                            <span className="opacity-75 font-normal">View Result</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/exam/${exam.id}`)}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                          >
                            <span>Start Exam</span>
                            <span>→</span>
                          </button>
                        )}
                      </div>
                    )}

                    {user.role === UserRole.INSTRUCTOR && (
                      <button
                        onClick={() => navigate(`/instructor/exam/${exam.id}`)}
                        className="w-full bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
                      >
                        View Analytics
                      </button>
                    )}
                  </div>
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
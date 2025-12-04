import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockDatabase';
import { Exam, ExamAttempt, User } from '../types';

const InstructorExamView: React.FC<{ user: User }> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<(ExamAttempt & { studentName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (id) {
        const e = await db.getExam(id);
        if (e) {
          if (e.instructorId !== user.id) {
            alert("Unauthorized access");
            navigate('/dashboard');
            return;
          }
          setExam(e);
          
          const rawAttempts = await db.getAttemptsForExam(id);
          // Enrich with student names
          const enrichedAttempts = await Promise.all(rawAttempts.map(async (att) => {
            const student = await db.getUser(att.studentId);
            return { ...att, studentName: student?.name || 'Unknown Student' };
          }));
          
          setAttempts(enrichedAttempts);
        } else {
          alert("Exam not found");
          navigate('/dashboard');
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [id, user.id, navigate]);

  if (loading) return <div className="p-8 text-center">Loading Exam Data...</div>;
  if (!exam) return <div className="p-8 text-center">Exam not found</div>;

  const averageScore = attempts.length > 0 
    ? Math.round(attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / attempts.length)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <button onClick={() => navigate('/dashboard')} className="text-slate-500 hover:text-slate-800 text-sm mb-2">← Back to Dashboard</button>
           <h1 className="text-3xl font-bold text-slate-900">{exam.title}</h1>
           <p className="text-slate-500">Instructor View • {attempts.length} Attempts</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-3 rounded-lg border border-slate-200 shadow-sm text-center">
             <div className="text-xs text-slate-400 font-bold uppercase">Average Score</div>
             <div className="text-2xl font-bold text-indigo-600">{averageScore}%</div>
          </div>
          <div className="bg-white px-6 py-3 rounded-lg border border-slate-200 shadow-sm text-center">
             <div className="text-xs text-slate-400 font-bold uppercase">Students</div>
             <div className="text-2xl font-bold text-slate-800">{attempts.length}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Student Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date Taken</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Score</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Violations</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No students have taken this exam yet.
                  </td>
                </tr>
              ) : (
                attempts.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{att.studentName}</div>
                      <div className="text-xs text-slate-400 font-mono">{att.studentId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(att.startTime).toLocaleDateString()}
                      <div className="text-xs text-slate-400">
                        {new Date(att.startTime).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (att.score || 0) >= 70 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {att.score}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {att.violations.length > 0 ? (
                        <span className="text-red-600 font-bold text-sm flex items-center gap-1">
                          ⚠️ {att.violations.length}
                        </span>
                      ) : (
                        <span className="text-green-600 text-sm">Clean</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/result/${att.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        View Analysis →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InstructorExamView;
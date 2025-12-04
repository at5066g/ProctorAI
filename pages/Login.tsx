import React, { useState } from 'react';
import { User } from '../types';
import { db, USERS_CSV } from '../services/mockDatabase';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const user = await db.login(email, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid email or password');
      }
    } catch (e) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([USERS_CSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proctorai_credentials.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to ProctorAI</h1>
          <p className="text-slate-500 mt-2">Cloud-Powered Examination Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-4 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
        
        <div className="pt-6 border-t border-slate-100">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 text-center">
             Default Credentials (On First Run)
           </h3>
           <div className="text-sm text-slate-600 space-y-2 bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span>student@test.com</span>
                <span className="font-mono text-slate-400">123456</span>
              </div>
              <div className="flex justify-between">
                <span>shwetha@test.com</span>
                <span className="font-mono text-slate-400">admin123</span>
              </div>
           </div>
           
           <button 
             onClick={downloadCSV}
             className="mt-4 w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-1"
           >
             Download CSV Backup
           </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
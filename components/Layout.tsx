import React from 'react';
import { useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, title }) => {
  const location = useLocation();
  const isExamInProgress = user?.role === UserRole.STUDENT && location.pathname.startsWith('/exam/');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Glassmorphism Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-800 tracking-tight leading-none">ProctorAI</span>
                {title && <span className="text-xs text-indigo-600 font-medium tracking-wide uppercase">{title}</span>}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500 font-medium">{user.role}</div>
                  </div>
                  <button 
                    onClick={onLogout}
                    disabled={isExamInProgress}
                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                      isExamInProgress 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'text-white bg-slate-900 hover:bg-slate-800 shadow-sm hover:shadow'
                    }`}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm font-medium">
            &copy; {new Date().getFullYear()} ProctorAI. Secure Examination Platform.
          </p>
          <div className="flex justify-center gap-4 mt-2 text-xs text-slate-300">
            <span>Powered by Gemini</span>
            <span>•</span>
            <span>Firebase Cloud</span>
            <span>•</span>
            <span>Vite</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
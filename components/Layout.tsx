import React from 'react';
import { User, UserRole } from '../types';
import { db } from '../services/mockDatabase';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, title }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">P</span>
              </div>
              <span className="text-xl font-bold text-slate-800">ProctorAI</span>
              {title && (
                 <>
                   <span className="text-slate-300">|</span>
                   <span className="text-slate-600 font-medium">{title}</span>
                 </>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.role}</div>
                  </div>
                  <button 
                    onClick={onLogout}
                    className="text-sm text-red-600 hover:text-red-800 font-medium bg-red-50 px-3 py-1.5 rounded-md transition-colors"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} ProctorAI. Secure Examination Platform.
        </div>
      </footer>
    </div>
  );
};
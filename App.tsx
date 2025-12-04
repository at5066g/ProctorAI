import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateExam from './pages/CreateExam';
import TakeExam from './pages/TakeExam';
import ExamResult from './pages/ExamResult';
import InstructorExamView from './pages/InstructorExamView';
import { User, UserRole } from './types';
import { db } from './services/mockDatabase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Current user is still synced to localstorage for speed, but validated against firestore on actions
    const currentUser = db.getCurrentUser();
    if (currentUser) setUser(currentUser);
  }, []);

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route 
            path="/create" 
            element={user.role === UserRole.INSTRUCTOR ? <CreateExam user={user} /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/edit/:id" 
            element={user.role === UserRole.INSTRUCTOR ? <CreateExam user={user} /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/instructor/exam/:id" 
            element={user.role === UserRole.INSTRUCTOR ? <InstructorExamView user={user} /> : <Navigate to="/dashboard" />} 
          />
          <Route 
            path="/exam/:id" 
            element={user.role === UserRole.STUDENT ? <TakeExam user={user} /> : <Navigate to="/dashboard" />} 
          />
          <Route path="/result/:id" element={<ExamResult />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
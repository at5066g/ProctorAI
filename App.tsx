import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateExam from './pages/CreateExam';
import TakeExam from './pages/TakeExam';
import ExamResult from './pages/ExamResult';
import InstructorExamView from './pages/InstructorExamView';
import AdminDashboard from './pages/AdminDashboard';
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
      <Layout user={user} onLogout={handleLogout} title={user.role === UserRole.ADMIN ? 'Administrator' : undefined}>
        <Routes>
          {/* Main Route Handling: Admins go to /admin, others to /dashboard */}
          <Route path="/" element={
            user.role === UserRole.ADMIN 
              ? <Navigate to="/admin" replace /> 
              : <Navigate to="/dashboard" replace />
          } />

          {/* Role-Protected Routes */}
          <Route path="/admin" element={
            user.role === UserRole.ADMIN 
              ? <AdminDashboard /> 
              : <Navigate to="/dashboard" />
          } />

          <Route path="/dashboard" element={
            user.role === UserRole.ADMIN 
              ? <Navigate to="/admin" /> 
              : <Dashboard user={user} />
          } />

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
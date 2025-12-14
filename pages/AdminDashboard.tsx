import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { User, UserRole } from '../types';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.STUDENT);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const allUsers = await db.getAllUsers();
    setUsers(allUsers);
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const newUser = {
        id: `u-${Date.now()}`, // Auto-generate ID
        name: newName,
        email: newEmail,
        password: newPassword, // Note: storing plain text for this demo. Use hashing in real prod.
        role: newRole
      };
      
      await db.createUser(newUser);
      
      // Reset form
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole(UserRole.STUDENT);
      
      alert("User created successfully!");
      fetchUsers();
    } catch (error: any) {
      alert("Error creating user: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Manage Student and Instructor Credentials.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Create User Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-fit">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input 
                required
                value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input 
                required
                type="email"
                value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. john@university.edu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input 
                required
                type="password"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Initial password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <select 
                value={newRole} 
                onChange={e => setNewRole(e.target.value as UserRole)}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={UserRole.STUDENT}>Student</option>
                <option value={UserRole.INSTRUCTOR}>Instructor</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>
            
            <button 
              type="submit"
              disabled={creating}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Credentials'}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
             <h2 className="font-bold text-slate-800 dark:text-white">System Users</h2>
             <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-full">{users.length} Total</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold sticky top-0">
                <tr>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                   <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">Loading users...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                        u.role === UserRole.ADMIN ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' :
                        u.role === UserRole.INSTRUCTOR ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' :
                        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400 text-sm">{u.email}</td>
                    <td className="px-6 py-3 text-slate-400 dark:text-slate-500 text-xs font-mono">{u.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
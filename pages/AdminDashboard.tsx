import React, { useState, useEffect } from 'react';
import { db } from '../services/mockDatabase';
import { User, UserRole } from '../types';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = db.getCurrentUser();
  
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

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.id === currentUser?.id) {
      alert("You cannot delete your own administrative account.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete user ${userToDelete.name}? This action cannot be undone and will remove them from the cloud database.`)) {
      try {
        await db.deleteUser(userToDelete.id);
        fetchUsers();
      } catch (e: any) {
        alert("Failed to delete user: " + e.message);
      }
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
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                   <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">Loading users...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
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
                    <td className="px-6 py-3 text-right">
                      {u.id !== currentUser?.id ? (
                        <button 
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Delete User"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 italic px-2">Current Session</span>
                      )}
                    </td>
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
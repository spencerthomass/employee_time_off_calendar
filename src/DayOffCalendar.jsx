import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, CheckCircle, XCircle, LogOut, Settings, X, MessageSquare, Send, Key } from 'lucide-react';

const DayOffCalendar = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState({});
  const [requests, setRequests] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdmin, setShowAdmin] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', allowance: 10, isAdmin: false });
  const [modal, setModal] = useState({ show: false, type: '', data: null });
  const [passwordChange, setPasswordChange] = useState({ current: '', new: '', confirm: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch from backend
      const usersRes = await fetch('/api/storage/dayoff-users');
      const usersResult = await usersRes.json();
      
      const reqRes = await fetch('/api/storage/dayoff-requests');
      const requestsResult = await reqRes.json();
      
      if (usersResult && usersResult.value) {
        setUsers(JSON.parse(usersResult.value));
      } else {
        const initialUsers = {
          admin: { password: 'admin', isAdmin: true, allowance: 0, used: 0 }
        };
        setUsers(initialUsers);
        // Save initial state
        await fetch('/api/storage/dayoff-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: JSON.stringify(initialUsers) })
        });
      }
      
      if (requestsResult && requestsResult.value) {
        setRequests(JSON.parse(requestsResult.value));
      }
    } catch (error) {
      console.error("Error loading data", error);
    }
  };

  const saveUsers = async (updatedUsers) => {
    setUsers(updatedUsers);
    await fetch('/api/storage/dayoff-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(updatedUsers) })
    });
  };

  const saveRequests = async (updatedRequests) => {
    setRequests(updatedRequests);
    await fetch('/api/storage/dayoff-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(updatedRequests) })
    });
  };

  // --- HELPER FUNCTION ---
  const getUsedDaysForYear = (username, year) => {
    return requests.filter(r => 
      r.username === username && 
      r.date.startsWith(String(year)) &&
      r.status !== 'rejected' 
    ).length;
  };

  const login = () => {
    if (users[username] && users[username].password === password) {
      setCurrentUser(username);
      setUsername('');
      setPassword('');
    } else {
      setModal({ show: true, type: 'error', data: { message: 'Invalid credentials' } });
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setShowAdmin(false);
  };

  const handleDayClick = (date) => {
    if (!currentUser || users[currentUser].isAdmin) return;

    const dateStr = date.toISOString().split('T')[0];
    const targetYear = date.getFullYear();
    const existing = requests.find(r => r.username === currentUser && r.date === dateStr);
    
    if (existing) {
      setModal({ 
        show: true, 
        type: 'requestComments', 
        data: { requestId: existing.id } 
      });
      return;
    }

    const user = users[currentUser];
    const usedInTargetYear = getUsedDaysForYear(currentUser, targetYear);

    if (usedInTargetYear >= user.allowance) {
      setModal({ 
        show: true, 
        type: 'error', 
        data: { message: `You have used all your day-off allowance for the year ${targetYear}` } 
      });
      return;
    }

    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    setModal({ 
      show: true, 
      type: 'requestDay', 
      data: { date: dateStr, formattedDate } 
    });
  };

  const confirmRequestDay = () => {
    const { date } = modal.data;
    const newRequest = {
      id: Date.now(),
      username: currentUser,
      date: date,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      comments: []
    };

    saveRequests([...requests, newRequest]);
    setModal({ show: false, type: '', data: null });
  };

  const deletePendingRequest = (requestId) => {
    const updatedRequests = requests.filter(r => r.id !== requestId);
    saveRequests(updatedRequests);
    setModal({ show: false, type: '', data: null });
  };

  const approveRequest = (requestId, approved) => {
    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        return { 
          ...r, 
          status: approved ? 'approved' : 'rejected',
          processedAt: new Date().toISOString(),
          processedBy: currentUser
        };
      }
      return r;
    });

    saveRequests(updatedRequests);
  };

  const addComment = (requestId, text) => {
    if (!text.trim()) return;
    
    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        const newComment = {
          id: Date.now(),
          author: currentUser,
          text: text,
          timestamp: new Date().toISOString()
        };
        return { 
          ...r, 
          comments: r.comments ? [...r.comments, newComment] : [newComment] 
        };
      }
      return r;
    });
    
    saveRequests(updatedRequests);
  };

  const createUser = () => {
    if (!newUser.username || !newUser.password) {
      setModal({ show: true, type: 'error', data: { message: 'Username and password required' } });
      return;
    }
    if (users[newUser.username]) {
      setModal({ show: true, type: 'error', data: { message: 'User already exists' } });
      return;
    }

    const updatedUsers = {
      ...users,
      [newUser.username]: {
        password: newUser.password,
        isAdmin: newUser.isAdmin,
        allowance: newUser.isAdmin ? 0 : parseInt(newUser.allowance),
        used: 0
      }
    };
    saveUsers(updatedUsers);
    setNewUser({ username: '', password: '', allowance: 10, isAdmin: false });
  };

  const deleteUser = (username) => {
    if (username === 'admin') {
      setModal({ show: true, type: 'error', data: { message: 'Cannot delete admin user' } });
      return;
    }
    setModal({ show: true, type: 'confirmDeleteUser', data: { username } });
  };

  const confirmDeleteUser = () => {
    const { username } = modal.data;
    const updatedUsers = { ...users };
    delete updatedUsers[username];
    saveUsers(updatedUsers);
    
    const updatedRequests = requests.filter(r => r.username !== username);
    saveRequests(updatedRequests);
    
    setModal({ show: false, type: '', data: null });
  };

  // --- NEW: Admin Password Reset Logic ---
  const performAdminPasswordReset = (targetUsername, newPassword) => {
    if (!newPassword || newPassword.length < 4) {
      // We handle this validation inside the Modal mostly, but safety check here
      return;
    }
    const updatedUsers = {
      ...users,
      [targetUsername]: { ...users[targetUsername], password: newPassword }
    };
    saveUsers(updatedUsers);
    setModal({ show: true, type: 'success', data: { message: `Password for ${targetUsername} has been updated.` } });
  };

  const updateUserAllowance = (username, newAllowance) => {
    const updatedUsers = {
      ...users,
      [username]: { ...users[username], allowance: parseInt(newAllowance) }
    };
    saveUsers(updatedUsers);
  };

  const changePassword = () => {
    if (!passwordChange.current || !passwordChange.new || !passwordChange.confirm) {
      setModal({ show: true, type: 'error', data: { message: 'All password fields are required' } });
      return;
    }

    if (users[currentUser].password !== passwordChange.current) {
      setModal({ show: true, type: 'error', data: { message: 'Current password is incorrect' } });
      return;
    }

    if (passwordChange.new !== passwordChange.confirm) {
      setModal({ show: true, type: 'error', data: { message: 'New passwords do not match' } });
      return;
    }

    if (passwordChange.new.length < 4) {
      setModal({ show: true, type: 'error', data: { message: 'Password must be at least 4 characters' } });
      return;
    }

    const updatedUsers = {
      ...users,
      [currentUser]: { ...users[currentUser], password: passwordChange.new }
    };
    saveUsers(updatedUsers);
    setPasswordChange({ current: '', new: '', confirm: '' });
    setModal({ show: true, type: 'success', data: { message: 'Password changed successfully!' } });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getApprovedRequestsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return requests.filter(r => r.date === dateStr && r.status === 'approved');
  };

  const getPendingRequestsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return requests.filter(r => r.date === dateStr && r.status === 'pending');
  };

  const getPendingRequests = () => {
    return requests.filter(r => r.status === 'pending');
  };

  const getUserNotifications = () => {
    if (!currentUser || users[currentUser]?.isAdmin) return [];
    return requests.filter(r => 
      r.username === currentUser && 
      (r.status === 'approved' || r.status === 'rejected')
    );
  };

  const getUserPendingRequests = () => {
    if (!currentUser || users[currentUser]?.isAdmin) return [];
    return requests.filter(r => 
      r.username === currentUser && 
      r.status === 'pending'
    );
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const Modal = () => {
    const [commentText, setCommentText] = useState('');
    const [adminNewPass, setAdminNewPass] = useState(''); // State for admin reset input
    const commentsEndRef = useRef(null);

    // Scroll to bottom of comments when modal opens or comments change
    useEffect(() => {
        if (modal.type === 'requestComments' && commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [modal.type, requests]);

    if (!modal.show) return null;

    const currentRequest = modal.data?.requestId 
      ? requests.find(r => r.id === modal.data.requestId) 
      : null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold">
              {modal.type === 'requestDay' && 'Request Day Off'}
              {modal.type === 'cancelRequest' && 'Cancel Request'}
              {modal.type === 'confirmDeleteUser' && 'Delete User'}
              {modal.type === 'adminResetPassword' && 'Reset User Password'}
              {modal.type === 'requestComments' && 'Request Details & Comments'}
              {modal.type === 'error' && 'Notice'}
              {modal.type === 'success' && 'Success'}
            </h3>
            <button onClick={() => setModal({ show: false, type: '', data: null })}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {modal.type === 'requestDay' && (
            <>
              <p className="mb-6">
                Do you want to request <strong>{modal.data.formattedDate}</strong> off?
                <br />
                <span className="text-sm text-gray-600">This will be sent to an admin for approval.</span>
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModal({ show: false, type: '', data: null })}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRequestDay}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Request Day Off
                </button>
              </div>
            </>
          )}

          {modal.type === 'cancelRequest' && (
            <>
              <p className="mb-6">
                You already have a pending request for this day. Would you like to cancel it?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModal({ show: false, type: '', data: null })}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={() => deletePendingRequest(modal.data.requestId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Cancel Request
                </button>
              </div>
            </>
          )}

          {/* ADMIN RESET PASSWORD MODAL */}
          {modal.type === 'adminResetPassword' && (
            <>
              <p className="mb-4">
                Enter a new password for user <strong>{modal.data.username}</strong>:
              </p>
              <input 
                type="password" 
                placeholder="New Password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={adminNewPass}
                onChange={(e) => setAdminNewPass(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModal({ show: false, type: '', data: null })}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performAdminPasswordReset(modal.data.username, adminNewPass)}
                  disabled={adminNewPass.length < 4}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Save Password
                </button>
              </div>
            </>
          )}

          {/* COMMENTS MODAL */}
          {modal.type === 'requestComments' && currentRequest && (
            <div className="flex flex-col h-96">
                <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">{currentRequest.date}</span>
                        <span className={`text-xs px-2 py-1 rounded capitalize ${
                            currentRequest.status === 'approved' ? 'bg-green-100 text-green-800' :
                            currentRequest.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {currentRequest.status}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Requested by {currentRequest.username} on {formatDateTime(currentRequest.requestedAt)}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto mb-4 border rounded p-2 bg-gray-50 space-y-3">
                    {(!currentRequest.comments || currentRequest.comments.length === 0) && (
                        <p className="text-center text-gray-500 text-sm mt-4">No comments yet.</p>
                    )}
                    {currentRequest.comments?.map(comment => (
                        <div key={comment.id} className={`flex flex-col ${
                            comment.author === currentUser ? 'items-end' : 'items-start'
                        }`}>
                            <div className={`max-w-[85%] rounded-lg p-2 text-sm ${
                                comment.author === currentUser 
                                    ? 'bg-indigo-100 text-indigo-900 rounded-tr-none' 
                                    : 'bg-white border border-gray-200 rounded-tl-none'
                            }`}>
                                <p className="font-semibold text-xs mb-1 text-opacity-75">
                                    {comment.author}
                                </p>
                                <p>{comment.text}</p>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1">
                                {formatDateTime(comment.timestamp)}
                            </span>
                        </div>
                    ))}
                    <div ref={commentsEndRef} />
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addComment(currentRequest.id, commentText) && setCommentText('')}
                        placeholder="Type a comment..."
                        className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        onClick={() => {
                            addComment(currentRequest.id, commentText);
                            setCommentText('');
                        }}
                        className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
          )}

          {modal.type === 'confirmDeleteUser' && (
            <>
              <p className="mb-6">
                Are you sure you want to delete user <strong>{modal.data.username}</strong>?
                <br />
                <br />
                <span className="text-sm text-red-600 font-bold">
                  Warning: This action cannot be undone. All request history for this user will be permanently deleted.
                </span>
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setModal({ show: false, type: '', data: null })}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </>
          )}

          {modal.type === 'error' && (
            <>
              <p className="mb-6">{modal.data.message}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setModal({ show: false, type: '', data: null })}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  OK
                </button>
              </div>
            </>
          )}

          {modal.type === 'success' && (
            <>
              <p className="mb-6 text-green-600">{modal.data.message}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setModal({ show: false, type: '', data: null })}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  OK
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <img 
              src="https://emissions-plus.com/wp-content/uploads/2018/10/cropped-eplus-logo-1.png" 
              alt="Emissions Plus Logo" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Day Off Calendar</h1>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && login()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={login}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              Login
            </button>
          </div>
        </div>
        <Modal />
      </div>
    );
  }

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const isAdmin = users[currentUser]?.isAdmin;
  const userStats = users[currentUser] || {};
  const notifications = getUserNotifications();
  const userPendingRequests = getUserPendingRequests();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src="https://emissions-plus.com/wp-content/uploads/2018/10/cropped-eplus-logo-1.png" 
                alt="Emissions Plus Logo" 
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                  Day Off Calendar
                </h1>
                <p className="text-gray-600 mt-1">
                  Logged in as: <span className="font-semibold">{currentUser}</span>
                  {isAdmin && <span className="ml-2 text-indigo-600">(Admin)</span>}
                </p>
                {!isAdmin && (
                  <p className="text-sm text-gray-600 mt-1">
                    Days used ({new Date().getFullYear()}): {getUsedDaysForYear(currentUser, new Date().getFullYear())} / {userStats.allowance || 0}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowAdmin(!showAdmin)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Admin Panel
                </button>
              )}
              <button
                onClick={logout}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="mt-4 space-y-2">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg ${
                    notif.status === 'approved' 
                      ? 'bg-green-100 border border-green-300' 
                      : 'bg-red-100 border border-red-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                      <p className="text-sm">
                        Your request for <strong>{notif.date}</strong> has been{' '}
                        <strong>{notif.status}</strong>
                      </p>
                      {/* COMMENT BUTTON FOR NOTIFICATIONS */}
                      <button
                        onClick={() => setModal({ show: true, type: 'requestComments', data: { requestId: notif.id } })}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                        title="View Comments"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAdmin && userPendingRequests.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Your Pending Requests</h3>
              <div className="space-y-2">
                {userPendingRequests.map(request => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{request.date}</p>
                      <p className="text-sm text-gray-600">Awaiting approval</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* COMMENT BUTTON FOR USER PENDING */}
                        <button
                          onClick={() => setModal({ show: true, type: 'requestComments', data: { requestId: request.id } })}
                          className="p-2 text-gray-600 hover:bg-yellow-100 rounded-full transition-colors"
                          title="Comments"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePendingRequest(request.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Change Password</h3>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Current Password"
                value={passwordChange.current}
                onChange={(e) => setPasswordChange({ ...passwordChange, current: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <input
                type="password"
                placeholder="New Password"
                value={passwordChange.new}
                onChange={(e) => setPasswordChange({ ...passwordChange, new: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={passwordChange.confirm}
                onChange={(e) => setPasswordChange({ ...passwordChange, confirm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                onClick={changePassword}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>

        {isAdmin && showAdmin && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Admin Panel
            </h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Pending Requests</h3>
              {getPendingRequests().length === 0 ? (
                <p className="text-gray-600">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {getPendingRequests().map(request => (
                    <div key={request.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold">{request.username}</p>
                          <p className="text-sm text-gray-600">Date: {request.date}</p>
                          <p className="text-xs text-gray-500">Requested: {formatDateTime(request.requestedAt)}</p>
                        </div>
                        <div className="flex gap-2 items-center">
                          {/* COMMENT BUTTON FOR ADMIN PENDING */}
                          <button
                            onClick={() => setModal({ show: true, type: 'requestComments', data: { requestId: request.id } })}
                            className="p-2 text-gray-600 hover:bg-yellow-100 rounded-full transition-colors"
                            title="Comments"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => approveRequest(request.id, true)}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => approveRequest(request.id, false)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3">Create New User</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {!newUser.isAdmin && (
                    <input
                      type="number"
                      placeholder="Allowance"
                      value={newUser.allowance}
                      onChange={(e) => setNewUser({ ...newUser, allowance: e.target.value })}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userType"
                      checked={!newUser.isAdmin}
                      onChange={() => setNewUser({ ...newUser, isAdmin: false })}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium">Standard User</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userType"
                      checked={newUser.isAdmin}
                      onChange={() => setNewUser({ ...newUser, isAdmin: true })}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium">Admin User</span>
                  </label>
                  <button
                    onClick={createUser}
                    className="ml-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create User
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Manage Users</h3>
              <div className="space-y-2">
                {Object.entries(users).map(([username, user]) => (
                  username !== 'admin' && (
                    <div key={username} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold">
                            {username}
                            {user.isAdmin && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Admin</span>}
                          </p>
                          {!user.isAdmin && (
                            <p className="text-sm text-gray-600">
                              Used ({new Date().getFullYear()}): {getUsedDaysForYear(username, new Date().getFullYear())} / Allowance: {user.allowance}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!user.isAdmin && (
                            <input
                              type="number"
                              value={user.allowance}
                              onChange={(e) => updateUserAllowance(username, e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          )}
                          
                          {/* NEW: RESET PASSWORD BUTTON */}
                          <button
                            onClick={() => setModal({ show: true, type: 'adminResetPassword', data: { username } })}
                            className="px-2 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm flex items-center gap-1"
                            title="Reset Password"
                          >
                            <Key className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => deleteUser(username)}
                            className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      {!user.isAdmin && requests.filter(r => r.username === username && r.status !== 'pending').length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <p className="text-xs font-semibold text-gray-700 mb-1">Request History:</p>
                          <div className="space-y-1">
                            {requests
                              .filter(r => r.username === username && r.status !== 'pending')
                              .sort((a, b) => new Date(b.processedAt || b.requestedAt) - new Date(a.processedAt || a.requestedAt))
                              .slice(0, 5)
                              .map(req => (
                                <div key={req.id} className={`text-xs p-2 rounded ${
                                  req.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
                                }`}>
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{req.date}</span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-semibold ${
                                        req.status === 'approved' ? 'text-green-700' : 'text-red-700'
                                      }`}>
                                        {req.status}
                                      </span>
                                      
                                      {/* COMMENT BUTTON FOR ADMIN HISTORY */}
                                      <button
                                        onClick={() => setModal({ show: true, type: 'requestComments', data: { requestId: req.id } })}
                                        className="p-1 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                                        title="Comments"
                                      >
                                        <MessageSquare className="w-3 h-3" />
                                      </button>

                                      {req.status === 'approved' && (
                                        <button
                                          onClick={() => approveRequest(req.id, false)}
                                          className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200 border border-red-200 transition-colors"
                                          title="Revoke Approval"
                                        >
                                          Unapprove
                                        </button>
                                      )}
                                      {req.status === 'rejected' && (
                                        <button
                                          onClick={() => approveRequest(req.id, true)}
                                          className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 border border-green-200 transition-colors"
                                          title="Re-Approve"
                                        >
                                          Approve
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-gray-600 mt-1">
                                    Requested: {formatDateTime(req.requestedAt)}
                                  </div>
                                  {req.processedAt && (
                                    <div className="text-gray-600">
                                      {req.status === 'approved' ? 'Approved' : 'Rejected'}: {formatDateTime(req.processedAt)}
                                      {req.processedBy && ` by ${req.processedBy}`}
                                    </div>
                                  )}
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Previous
            </button>
            <h2 className="text-2xl font-bold text-gray-800">{monthName}</h2>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-bold text-gray-700 py-2">
                {day}
              </div>
            ))}
            
            {days.map((date, index) => {
              const approvedRequests = date ? getApprovedRequestsForDate(date) : [];
              const pendingRequests = date ? getPendingRequestsForDate(date) : [];
              const isToday = date && date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (date && !isAdmin) {
                      handleDayClick(date);
                    }
                  }}
                  className={`min-h-24 p-2 border rounded-lg ${
                    !date ? 'bg-gray-50' : ''
                  } ${isToday ? 'border-2 border-indigo-600' : 'border-gray-200'} ${
                    date && !isAdmin ? 'cursor-pointer hover:bg-indigo-50 hover:shadow-md transition-all' : ''
                  }`}
                >
                  {date && (
                    <>
                      <div className="font-semibold text-gray-800 mb-1">
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {approvedRequests.map(req => (
                          <div
                            key={req.id}
                            className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {req.username}
                          </div>
                        ))}
                        {pendingRequests.map(req => (
                          <div
                            key={req.id}
                            className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {req.username} (Pending)
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Modal />
    </div>
  );
};

export default DayOffCalendar;

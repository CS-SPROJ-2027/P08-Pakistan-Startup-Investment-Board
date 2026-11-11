/**
 * UC-001: Admin page to approve or reject new accounts.
 * Shows registrations by status. Rejecting requires a reason.
 */
import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

function AdminUsers() {
  const [status, setStatus] = useState('pending');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadUsers() {
    setError('');
    try {
      const data = await apiRequest(`/admin/users?status=${status}`);
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [status]);

  async function reviewUser(user, decision) {
    let reason = '';
    if (decision === 'reject') {
      reason = window.prompt(`Reason for rejecting ${user.full_name}:`);
      if (reason === null) {
        return;
      }
    }

    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/admin/users/${user.id}/review`, 'POST', { decision, reason });
      setMessage(`${data.message}: ${user.email}`);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Account Approvals</h2>

      <label htmlFor="status">Show</label>
      <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="small-select">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {users.length === 0 ? (
        <p className="muted">No {status} accounts.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Company / Organisation</th>
              <th>Registered</th>
              <th>{status === 'pending' ? 'Action' : 'Reviewed'}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.organisation}</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  {status === 'pending' ? (
                    <>
                      <button onClick={() => reviewUser(user, 'approve')}>Approve</button>{' '}
                      <button className="danger" onClick={() => reviewUser(user, 'reject')}>Reject</button>
                    </>
                  ) : (
                    <>
                      {new Date(user.reviewed_at).toLocaleString()} by {user.reviewed_by_name}
                      {user.rejection_reason && <div className="muted">Reason: {user.rejection_reason}</div>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminUsers;

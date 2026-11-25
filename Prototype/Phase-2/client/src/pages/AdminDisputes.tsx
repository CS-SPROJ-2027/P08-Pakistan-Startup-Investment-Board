/**
 * UC-006 (A2): Admin page for disputed ratings.
 * The administrator can override a rating or keep it. A reason is required
 * and is written to the audit log.
 */
import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

interface Dispute {
  id: number;
  companyName: string;
  category: string;
  currentRating: number | null;
  met: string[];
  missing: string[];
  reason: string;
  createdAt: string;
}

function AdminDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [newRatings, setNewRatings] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadDisputes() {
    try {
      const data = await apiRequest('/admin/disputes');
      setDisputes(data.disputes);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    loadDisputes();
  }, []);

  async function review(dispute: Dispute, action: string) {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/admin/disputes/${dispute.id}/review`, 'POST', {
        action,
        newRating: newRatings[dispute.id] ?? '',
        reason: reasons[dispute.id] || '',
      });
      setMessage(`${dispute.companyName} – ${dispute.category}: ${data.message}`);
      loadDisputes();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <h2>Disputed Ratings</h2>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {disputes.length === 0 && <p className="muted">No disputes waiting for review.</p>}

      {disputes.map((d) => (
        <div className="card" key={d.id}>
          <h3>
            {d.companyName} – {d.category} ({d.currentRating} / 5)
          </h3>
          <p>
            <strong>Founder's reason:</strong> {d.reason}
          </p>
          <p className="muted">Met: {d.met.join(', ') || 'none'}</p>
          <p className="muted">Missing: {d.missing.join(', ') || 'none'}</p>

          <label htmlFor={`rating-${d.id}`}>New rating (only for override)</label>
          <select
            id={`rating-${d.id}`}
            className="small-select"
            value={newRatings[d.id] ?? ''}
            onChange={(e) => setNewRatings({ ...newRatings, [d.id]: e.target.value })}
          >
            <option value="">Select</option>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <label htmlFor={`reason-${d.id}`}>Reason</label>
          <textarea
            id={`reason-${d.id}`}
            value={reasons[d.id] || ''}
            onChange={(e) => setReasons({ ...reasons, [d.id]: e.target.value })}
          />
          <button onClick={() => review(d, 'override')}>Override rating</button>{' '}
          <button className="secondary" onClick={() => review(d, 'keep')}>Keep rating</button>
        </div>
      ))}
    </div>
  );
}

export default AdminDisputes;

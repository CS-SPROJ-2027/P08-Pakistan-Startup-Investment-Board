/**
 * UC-010: Access settings page for founders.
 * Shows who can see the startup, lets the founder share with an organisation
 * (after showing what they will see) and revoke access.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';

interface Grant {
  id: number;
  organisation: string;
  organisation_type: string;
  granted_at: string;
}

interface Organisation {
  organisation: string;
  organisation_type: string;
}

interface Activity {
  id: number;
  action: string;
  details: string;
  created_at: string;
  full_name: string;
}

function AccessSettings() {
  const [status, setStatus] = useState('');
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadPage() {
    try {
      const data = await apiRequest('/access');
      setStatus(data.status);
      setLatestVersion(data.latestVersion);
      setGrants(data.grants);
      setOrganisations(data.organisations);
      setActivity(data.activity);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  async function confirmGrant() {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest('/access', 'POST', { organisation: selected });
      setMessage(data.message);
      setSelected('');
      loadPage();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(grant: Grant) {
    if (!window.confirm(`Remove access for ${grant.organisation}?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/access/${grant.id}/revoke`, 'POST');
      setMessage(data.message);
      loadPage();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  // organisations that do not have access yet
  const available = organisations.filter((org) => !grants.some((g) => g.organisation === org.organisation));
  const canShare = status === 'ready_for_review';

  return (
    <div>
      <h2>Access Settings</h2>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="card">
        <h3>Who can see my startup</h3>
        {grants.length === 0 ? (
          <p className="muted">You have not shared your startup with anyone yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Type</th>
                <th>Shared on</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td>{grant.organisation}</td>
                  <td>{grant.organisation_type}</td>
                  <td>{new Date(grant.granted_at).toLocaleDateString()}</td>
                  <td>
                    <button className="danger" onClick={() => revoke(grant)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Share with an organisation</h3>
        {!canShare ? (
          <p className="error">
            Your profile must be submitted and "Ready for review" before you can share it.{' '}
            <Link to="/profile">Go to my profile</Link>
          </p>
        ) : available.length === 0 ? (
          <p className="muted">There are no other organisations to share with right now.</p>
        ) : (
          <>
            <label htmlFor="organisation">Organisation</label>
            <select id="organisation" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select organisation</option>
              {available.map((org) => (
                <option key={org.organisation} value={org.organisation}>
                  {org.organisation} ({org.organisation_type})
                </option>
              ))}
            </select>

            {selected && (
              <div className="preview">
                <p>
                  <strong>{selected}</strong> will be able to see:
                </p>
                <ul>
                  <li>Your submitted startup profile (version {latestVersion}): company, sector, stage, team, traction, revenue, cap table and round details</li>
                  <li>Data room documents and the diligence memo, once they are added</li>
                </ul>
                <p className="muted">You can remove their access at any time.</p>
                <button onClick={confirmGrant}>Confirm and share</button>{' '}
                <button className="secondary" onClick={() => setSelected('')}>Cancel</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3>Activity log</h3>
        {activity.length === 0 ? (
          <p className="muted">No activity yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>What happened</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.details}</td>
                  <td>{item.full_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AccessSettings;

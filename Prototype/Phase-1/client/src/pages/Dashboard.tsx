/**
 * Dashboard page shown after login.
 * Founders also see their startup profile status here.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { User } from '../types';

interface Props {
  user: User;
}

interface ProfileSummary {
  companyName: string;
  status: string;
  completeness: number;
  latestVersion: number | null;
}

function Dashboard({ user }: Props) {
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user.role !== 'founder') {
      return;
    }
    apiRequest('/profile')
      .then((data) =>
        setSummary({
          companyName: data.profile.companyName,
          status: data.status,
          completeness: data.completeness,
          latestVersion: data.latestVersion,
        })
      )
      .catch((err: Error) => setError(err.message));
  }, [user.role]);

  return (
    <div>
      <div className="card">
        <h2>Welcome, {user.fullName}</h2>
        <p>You are logged in as: {user.role}</p>
        {(user.role === 'investor' || user.role === 'incubator') && (
          <Link to="/startups">See startups shared with your organisation</Link>
        )}
      </div>

      {user.role === 'founder' && (
        <div className="card">
          <h3>My startup</h3>
          {error && <p className="error">{error}</p>}
          {summary && (
            <>
              <p>Company: {summary.companyName || 'Not entered yet'}</p>
              <p>
                Status: <strong>{summary.status === 'ready_for_review' ? 'Ready for review' : 'Draft'}</strong>
                {summary.latestVersion && ` (last submitted: version ${summary.latestVersion})`}
              </p>
              <p>Completeness: {summary.completeness}%</p>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${summary.completeness}%` }} />
              </div>
            </>
          )}
          <p>
            <Link to="/profile">Go to my startup profile</Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

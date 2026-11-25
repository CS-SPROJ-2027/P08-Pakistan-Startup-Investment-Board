/**
 * UC-014: Details of one shared startup (read only).
 * If the founder has removed access, the user is sent back to the list with a message.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, ApiError } from '../api';
import { Profile } from '../profileRules';
import { ReadinessReport } from '../types';

function StartupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [version, setVersion] = useState(0);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest(`/startups/${id}`)
      .then((data) => {
        setProfile(data.profile);
        setVersion(data.version);
        setReadiness(data.readiness);
      })
      .catch((err) => {
        // access was revoked: go back to the list and show why
        if (err instanceof ApiError && err.message.includes('no longer have access')) {
          navigate('/startups', { replace: true, state: { notice: err.message } });
        } else {
          setError((err as Error).message);
        }
      });
  }, [id, navigate]);

  if (error) {
    return <p className="error">{error}</p>;
  }
  if (!profile) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <Link to="/startups">Back to shared startups</Link>
      <h2>{profile.companyName}</h2>
      <p className="muted">Submitted profile, version {version}</p>

      <div className="card">
        <h3>Company</h3>
        <p>Sector: {profile.sector}</p>
        <p>Stage: {profile.stage}</p>
        <p>City: {profile.city || '-'}</p>
      </div>

      <div className="card">
        <h3>Team</h3>
        <ul>
          {profile.team.map((member, index) => (
            <li key={index}>
              {member.name} – {member.role}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Traction and revenue</h3>
        <p>Active customers: {profile.activeCustomers ?? '-'}</p>
        <p>Revenue for {profile.revenuePeriod}: PKR {profile.monthlyRevenue?.toLocaleString()}</p>
        {profile.tractionNotes && <p>{profile.tractionNotes}</p>}
      </div>

      <div className="card">
        <h3>Cap table</h3>
        <table>
          <thead>
            <tr>
              <th>Shareholder</th>
              <th>Ownership (%)</th>
            </tr>
          </thead>
          <tbody>
            {profile.capTable.map((row, index) => (
              <tr key={index}>
                <td>{row.holder}</td>
                <td>{row.percentage ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Round details</h3>
        <p>Raising: PKR {profile.roundAmount?.toLocaleString()}</p>
        <p>Instrument: {profile.roundInstrument}</p>
        {profile.useOfFunds && <p>Use of funds: {profile.useOfFunds}</p>}
      </div>

      <div className="card">
        <h3>Readiness</h3>
        {!readiness ? (
          <p className="muted">The founder has not run a readiness check yet.</p>
        ) : (
          <>
            <p className="muted">
              Report from {new Date(readiness.createdAt).toLocaleDateString()}, rubric version {readiness.rubricVersion}
              {!readiness.documentsChecked && ' – Documents not checked'}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Rating</th>
                  <th>Criteria missing</th>
                </tr>
              </thead>
              <tbody>
                {readiness.ratings.map((r) => (
                  <tr key={r.category}>
                    <td>{r.category}</td>
                    <td>{r.rating === null ? 'Not assessed' : `${r.rating} / 5 (${r.description})`}</td>
                    <td>{r.missing.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Flags</h3>
            {readiness.flags.length === 0 ? (
              <p className="muted">No flags.</p>
            ) : (
              <ul>
                {readiness.flags.map((flag, index) => (
                  <li key={index}>
                    <strong>{flag.severity}</strong>: {flag.message} ({flag.source})
                    {flag.explanation && <div className="muted">Founder's explanation: {flag.explanation}</div>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StartupDetails;

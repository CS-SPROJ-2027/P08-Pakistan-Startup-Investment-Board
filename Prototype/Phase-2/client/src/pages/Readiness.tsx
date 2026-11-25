/**
 * UC-006: Readiness report page for founders.
 * The founder runs the check and sees the 0 to 5 rating, criteria met and missing
 * for each category, plus the consistency flags. A flag can be explained and a
 * rating can be disputed (the administrator then decides).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { ReadinessReport } from '../types';

interface Dispute {
  id: number;
  category: string;
  reason: string;
  status: string;
  new_rating: number | null;
  admin_reason: string | null;
}

function Readiness() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [disputeCategory, setDisputeCategory] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadPage() {
    try {
      const data = await apiRequest('/readiness');
      setReport(data.report);
      setDisputes(data.disputes);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  async function runCheck() {
    setError('');
    setMessage('');
    setRunning(true);
    try {
      const data = await apiRequest('/readiness', 'POST');
      setMessage(data.message);
      setExplanations({});
      loadPage();
    } catch (err) {
      // on failure the previous report stays on the page
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function saveExplanation(index: number) {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/readiness/${report!.id}/flags/${index}/explain`, 'POST', {
        explanation: explanations[index] || '',
      });
      setMessage(data.message);
      loadPage();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function sendDispute() {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest(`/readiness/${report!.id}/dispute`, 'POST', {
        category: disputeCategory,
        reason: disputeReason,
      });
      setMessage(data.message);
      setDisputeCategory('');
      setDisputeReason('');
      loadPage();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h2>Readiness Report</h2>
      <p className="muted">
        Checks your profile and data room documents and rates each area from 0 to 5.{' '}
        <Link to="/data-room">Upload documents</Link> to get a fuller report.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <button onClick={runCheck} disabled={running}>{running ? 'Checking...' : 'Run readiness check'}</button>

      {!report ? (
        <p className="muted">You have not run a readiness check yet.</p>
      ) : (
        <>
          <p className="muted">
            Report from {new Date(report.createdAt).toLocaleString()}, rubric version {report.rubricVersion}
          </p>
          {!report.documentsChecked && (
            <p className="error">Documents not checked. Only the information in your profile was used.</p>
          )}

          <div className="card">
            <h3>Ratings</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Rating</th>
                  <th>Criteria met</th>
                  <th>Criteria missing</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {report.ratings.map((r) => {
                  const dispute = disputes.find((d) => d.category === r.category);
                  return (
                    <tr key={r.category}>
                      <td>{r.category}</td>
                      <td>
                        <strong>{r.rating === null ? 'Not assessed' : `${r.rating} / 5`}</strong>
                        {r.rating !== null && <div className="muted">{r.description}</div>}
                        {r.overriddenFrom !== undefined && (
                          <div className="muted">
                            Changed by admin from {r.overriddenFrom}: {r.overrideReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <ul>{r.met.map((c) => <li key={c}>{c}</li>)}</ul>
                      </td>
                      <td>
                        <ul>{r.missing.map((c) => <li key={c}>{c}</li>)}</ul>
                      </td>
                      <td>
                        {dispute ? (
                          <span className="muted">
                            {dispute.status === 'pending' && 'Dispute sent, waiting for admin'}
                            {dispute.status === 'overridden' && 'Dispute accepted'}
                            {dispute.status === 'kept' && `Rating kept: ${dispute.admin_reason}`}
                          </span>
                        ) : (
                          r.rating !== null && (
                            <button className="secondary" onClick={() => setDisputeCategory(r.category)}>Dispute</button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {disputeCategory && (
              <div className="preview">
                <label htmlFor="disputeReason">Why do you disagree with the {disputeCategory} rating?</label>
                <textarea id="disputeReason" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
                <button onClick={sendDispute}>Send to admin</button>{' '}
                <button className="secondary" onClick={() => setDisputeCategory('')}>Cancel</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Consistency flags ({report.flags.length})</h3>
            {report.flags.length === 0 ? (
              <p className="success">No problems found.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Problem</th>
                    <th>Source</th>
                    <th>Your explanation (investors will see this)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.flags.map((flag, index) => (
                    <tr key={index}>
                      <td>{flag.severity}</td>
                      <td>{flag.message}</td>
                      <td>{flag.source}</td>
                      <td>
                        {flag.explanation ? (
                          flag.explanation
                        ) : (
                          <div className="row">
                            <input
                              value={explanations[index] || ''}
                              placeholder="Add an explanation"
                              onChange={(e) => setExplanations({ ...explanations, [index]: e.target.value })}
                            />
                            <button onClick={() => saveExplanation(index)}>Save</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Readiness;

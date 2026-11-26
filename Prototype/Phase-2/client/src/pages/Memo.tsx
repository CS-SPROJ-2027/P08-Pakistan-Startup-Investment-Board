/**
 * UC-016: Diligence memo of a shared startup.
 * Shows the summary, the six sections with an evidence link on every claim,
 * and the values left out because they still need to be verified.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../api';

interface Evidence {
  type: 'document' | 'profile';
  label: string;
  documentId?: number;
  cell?: string;
}

interface Section {
  title: string;
  claims: { text: string; evidence: Evidence[] }[];
  insufficient?: string;
}

interface MemoData {
  companyName: string;
  createdAt: string;
  profileVersion: number;
  dataRoomVersion: number;
  method: 'ai' | 'rules';
  model: string | null;
  narrative: string;
  sections: Section[];
  pending: { field: string; value: number; label: string }[];
}

function Memo() {
  const { id } = useParams();
  const [memo, setMemo] = useState<MemoData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // refresh = true writes the memo again even if nothing changed
  async function loadMemo(refresh: boolean) {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/startups/${id}/memo${refresh ? '?refresh=1' : ''}`);
      setMemo(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMemo(false);
  }, [id]);

  if (loading) {
    return <p>Writing the memo... this can take up to a minute when the AI model is used.</p>;
  }
  if (error || !memo) {
    return (
      <div>
        <p className="error">{error}</p>
        <Link to="/startups">Back to shared startups</Link>
      </div>
    );
  }

  return (
    <div>
      <h2>Diligence Memo: {memo.companyName}</h2>
      <p className="muted">
        Generated {new Date(memo.createdAt).toLocaleString()} · Profile version {memo.profileVersion} · Data room version{' '}
        {memo.dataRoomVersion} · <Link to={`/startups/${id}`}>Startup page</Link>
      </p>

      <div className="preview">
        {memo.method === 'ai'
          ? `AI-generated (${memo.model}), verify against source.`
          : 'The AI model was not available, so this summary was written by rules. Verify against source.'}{' '}
        All numbers are calculated in code.
      </div>

      <div className="card">
        <h3>Summary</h3>
        <p>{memo.narrative}</p>
      </div>

      {memo.sections.map((section) => (
        <div className="card" key={section.title}>
          <h3>{section.title}</h3>
          {section.insufficient ? (
            <p className="muted">{section.insufficient}</p>
          ) : section.claims.length === 0 ? (
            <p className="muted">None found.</p>
          ) : (
            <ul>
              {section.claims.map((claim, index) => (
                <li key={index}>
                  {claim.text}
                  <div className="muted">
                    Source:{' '}
                    {claim.evidence.map((e, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        {e.type === 'document' ? (
                          <Link to={`/startups/${id}/documents/${e.documentId}?cell=${encodeURIComponent(e.cell!)}`}>
                            {e.label}
                          </Link>
                        ) : (
                          e.label
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {memo.pending.length > 0 && (
        <div className="card">
          <h3>Values not used</h3>
          <p className="muted">These are marked "Verify" and are left out until the founder confirms them.</p>
          <ul>
            {memo.pending.map((p) => (
              <li key={p.field}>
                {p.field}: {p.value.toLocaleString()} ({p.label})
              </li>
            ))}
          </ul>
        </div>
      )}

      <button className="secondary" onClick={() => loadMemo(true)}>Write memo again</button>
    </div>
  );
}

export default Memo;

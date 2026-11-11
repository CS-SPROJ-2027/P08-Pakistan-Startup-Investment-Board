/**
 * UC-004: Startup profile page for founders.
 * The draft is autosaved every 30 seconds and when the founder leaves the page.
 * Completeness updates while typing. Submitting checks the mandatory fields.
 */
import { useEffect, useRef, useState, FormEvent } from 'react';
import { apiRequest, ApiError } from '../api';
import {
  Profile,
  SECTORS,
  STAGES,
  INSTRUMENTS,
  getCompleteness,
  getCapTableTotal,
} from '../profileRules';

const AUTOSAVE_SECONDS = 30;

function StartupProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState('draft');
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // refs so the timer and page-leave handler always see the latest values
  const profileRef = useRef<Profile | null>(null);
  const hasChanges = useRef(false);

  useEffect(() => {
    apiRequest('/profile')
      .then((data) => {
        setProfile(data.profile);
        profileRef.current = data.profile;
        setStatus(data.status);
        setLatestVersion(data.latestVersion);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function saveDraft() {
    if (!hasChanges.current || !profileRef.current) {
      return;
    }
    try {
      hasChanges.current = false;
      const data = await apiRequest('/profile', 'PUT', profileRef.current);
      setStatus(data.status);
      setSaveFailed(false);
      setSaveMessage(`Draft saved at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      // keep the changes so the next autosave tries again
      hasChanges.current = true;
      setSaveFailed(true);
      setSaveMessage(`Could not save draft: ${(err as Error).message}. Trying again in ${AUTOSAVE_SECONDS} seconds.`);
    }
  }

  // autosave every 30 seconds, and once more when leaving the page
  useEffect(() => {
    const timer = setInterval(saveDraft, AUTOSAVE_SECONDS * 1000);

    function handleTabClose() {
      if (hasChanges.current && profileRef.current) {
        // keepalive lets the request finish even after the tab is closed
        fetch('/api/profile', {
          method: 'PUT',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(profileRef.current),
        });
      }
    }
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleTabClose);
      saveDraft();
    };
  }, []);

  function updateProfile(changes: Partial<Profile>) {
    if (!profile) {
      return;
    }
    const updated = { ...profile, ...changes };
    setProfile(updated);
    profileRef.current = updated;
    hasChanges.current = true;
    setSaveMessage('Unsaved changes');
    setSuccess('');
  }

  // number inputs give a string; an empty box is saved as null
  function toNumber(value: string): number | null {
    return value === '' ? null : Number(value);
  }

  // Save button: saves the draft without submitting
  async function handleSaveClick() {
    if (!hasChanges.current) {
      setSaveFailed(false);
      setSaveMessage('All changes are already saved');
      return;
    }
    await saveDraft();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setMissingFields([]);
    setSubmitting(true);
    try {
      // save any unsaved changes first so the latest values are submitted
      await saveDraft();
      const data = await apiRequest('/profile/submit', 'POST');
      setStatus(data.status);
      setLatestVersion(data.latestVersion);
      setSuccess(data.message);
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError && err.data.missingFields) {
        setMissingFields(err.data.missingFields);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) {
    return <p>{error || 'Loading profile...'}</p>;
  }

  const completeness = getCompleteness(profile);
  const capTableTotal = getCapTableTotal(profile.capTable);

  return (
    <div>
      <h2>My Startup Profile</h2>

      <div className="card">
        <p>
          Status: <strong>{status === 'ready_for_review' ? 'Ready for review' : 'Draft'}</strong>
          {latestVersion && ` (last submitted: version ${latestVersion})`}
        </p>
        <p>Completeness: {completeness}%</p>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${completeness}%` }} />
        </div>
        {saveMessage && <p className={saveFailed ? 'error' : 'muted'}>{saveMessage}</p>}
        {status === 'draft' && latestVersion && (
          <p className="muted">You have changes that are not submitted yet. Investors only see submitted versions.</p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h3>Company</h3>
          <label htmlFor="companyName">Company name *</label>
          <input
            id="companyName"
            value={profile.companyName}
            onChange={(e) => updateProfile({ companyName: e.target.value })}
          />

          <label htmlFor="sector">Sector *</label>
          <select id="sector" value={profile.sector} onChange={(e) => updateProfile({ sector: e.target.value })}>
            <option value="">Select sector</option>
            {SECTORS.map((sector) => (
              <option key={sector}>{sector}</option>
            ))}
          </select>

          <label htmlFor="stage">Stage *</label>
          <select id="stage" value={profile.stage} onChange={(e) => updateProfile({ stage: e.target.value })}>
            <option value="">Select stage</option>
            {STAGES.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </div>

        <div className="card">
          <h3>Team *</h3>
          {profile.team.map((member, index) => (
            <div className="row" key={index}>
              <input
                placeholder="Name"
                value={member.name}
                onChange={(e) => {
                  const team = [...profile.team];
                  team[index] = { ...member, name: e.target.value };
                  updateProfile({ team });
                }}
              />
              <input
                placeholder="Role (e.g. CEO)"
                value={member.role}
                onChange={(e) => {
                  const team = [...profile.team];
                  team[index] = { ...member, role: e.target.value };
                  updateProfile({ team });
                }}
              />
              <button
                type="button"
                className="danger"
                onClick={() => updateProfile({ team: profile.team.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateProfile({ team: [...profile.team, { name: '', role: '' }] })}>
            Add team member
          </button>
        </div>

        <div className="card">
          <h3>Traction and revenue</h3>
          <label htmlFor="activeCustomers">Active customers</label>
          <input
            id="activeCustomers"
            type="number"
            min="0"
            value={profile.activeCustomers ?? ''}
            onChange={(e) => updateProfile({ activeCustomers: toNumber(e.target.value) })}
          />

          <label htmlFor="tractionNotes">Traction notes</label>
          <textarea
            id="tractionNotes"
            rows={3}
            value={profile.tractionNotes}
            onChange={(e) => updateProfile({ tractionNotes: e.target.value })}
          />

          <label htmlFor="revenuePeriod">Revenue period (month) *</label>
          <input
            id="revenuePeriod"
            type="month"
            value={profile.revenuePeriod}
            onChange={(e) => updateProfile({ revenuePeriod: e.target.value })}
          />

          <label htmlFor="monthlyRevenue">Revenue for that month (PKR) *</label>
          <input
            id="monthlyRevenue"
            type="number"
            min="0"
            value={profile.monthlyRevenue ?? ''}
            onChange={(e) => updateProfile({ monthlyRevenue: toNumber(e.target.value) })}
          />
        </div>

        <div className="card">
          <h3>Cap table *</h3>
          {profile.capTable.length > 0 && (
            <div className="row table-header">
              <span>Shareholder</span>
              <span>Ownership (%)</span>
              <span className="header-spacer" />
            </div>
          )}
          {profile.capTable.map((row, index) => (
            <div className="row" key={index}>
              <input
                placeholder="Shareholder"
                value={row.holder}
                onChange={(e) => {
                  const capTable = [...profile.capTable];
                  capTable[index] = { ...row, holder: e.target.value };
                  updateProfile({ capTable });
                }}
              />
              <input
                type="number"
                min="0"
                max="100"
                placeholder="%"
                value={row.percentage ?? ''}
                onChange={(e) => {
                  const capTable = [...profile.capTable];
                  capTable[index] = { ...row, percentage: toNumber(e.target.value) };
                  updateProfile({ capTable });
                }}
              />
              <button
                type="button"
                className="danger"
                onClick={() => updateProfile({ capTable: profile.capTable.filter((_, i) => i !== index) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => updateProfile({ capTable: [...profile.capTable, { holder: '', percentage: null }] })}
          >
            Add shareholder
          </button>
          {profile.capTable.length > 0 && (
            <p className={capTableTotal === 100 ? 'muted' : 'error'}>
              Total: {capTableTotal}%{capTableTotal !== 100 && ' (should add up to 100%)'}
            </p>
          )}
        </div>

        <div className="card">
          <h3>Round details</h3>
          <label htmlFor="roundAmount">Amount you are raising (PKR) *</label>
          <input
            id="roundAmount"
            type="number"
            min="0"
            value={profile.roundAmount ?? ''}
            onChange={(e) => updateProfile({ roundAmount: toNumber(e.target.value) })}
          />

          <label htmlFor="roundInstrument">Instrument *</label>
          <select
            id="roundInstrument"
            value={profile.roundInstrument}
            onChange={(e) => updateProfile({ roundInstrument: e.target.value })}
          >
            <option value="">Select instrument</option>
            {INSTRUMENTS.map((instrument) => (
              <option key={instrument}>{instrument}</option>
            ))}
          </select>

          <label htmlFor="useOfFunds">Use of funds</label>
          <textarea
            id="useOfFunds"
            rows={3}
            value={profile.useOfFunds}
            onChange={(e) => updateProfile({ useOfFunds: e.target.value })}
          />
        </div>

        {error && <p className="error">{error}</p>}
        {missingFields.length > 0 && (
          <ul className="error">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        )}
        {success && <p className="success">{success}</p>}

        <button type="button" className="secondary" onClick={handleSaveClick}>
          Save draft
        </button>{' '}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit profile'}
        </button>
      </form>
    </div>
  );
}

export default StartupProfile;

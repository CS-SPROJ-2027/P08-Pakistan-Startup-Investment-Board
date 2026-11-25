/**
 * UC-015: Compare 2 to 4 shared startups side by side.
 * Each startup is a column and each metric is a row. The analyst can sort by a
 * metric, remove a startup, and save the comparison to the organisation's shortlist.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import { Rating } from '../types';

interface CompareStartup {
  id: number;
  companyName: string;
  sector: string | null;
  stage: string | null;
  city: string | null;
  teamSize: number | null;
  activeCustomers: number | null;
  monthlyRevenue: number | null;
  revenuePeriod: string | null;
  roundAmount: number | null;
  roundInstrument: string | null;
  ratings: Rating[] | null;
  openFlags: number | null;
}

interface Metric {
  label: string;
  value: (s: CompareStartup) => string | number | null;
  format?: (s: CompareStartup) => string;
  // which value is best, used for highlighting (text rows have none)
  best?: 'high' | 'low';
}

const CATEGORIES = ['Team', 'Traction', 'Financials', 'Cap table', 'Fundraising'];

// Rating of one readiness category, or null if there is no report
function ratingOf(s: CompareStartup, category: string) {
  const rating = s.ratings ? s.ratings.find((r) => r.category === category) : undefined;
  return rating ? rating.rating : null;
}

const METRICS: Metric[] = [
  { label: 'Sector', value: (s) => s.sector },
  { label: 'Stage', value: (s) => s.stage },
  { label: 'City', value: (s) => s.city },
  { label: 'Team size', value: (s) => s.teamSize, best: 'high' },
  { label: 'Active customers', value: (s) => s.activeCustomers, best: 'high' },
  {
    label: 'Monthly revenue',
    value: (s) => s.monthlyRevenue,
    format: (s) => `PKR ${s.monthlyRevenue!.toLocaleString()}${s.revenuePeriod ? ` (${s.revenuePeriod})` : ''}`,
    best: 'high',
  },
  { label: 'Raising', value: (s) => s.roundAmount, format: (s) => `PKR ${s.roundAmount!.toLocaleString()}` },
  { label: 'Instrument', value: (s) => s.roundInstrument },
  ...CATEGORIES.map(
    (category): Metric => ({
      label: `Readiness: ${category}`,
      value: (s) => ratingOf(s, category),
      format: (s) => `${ratingOf(s, category)} / 5`,
      best: 'high',
    })
  ),
  { label: 'Open flags', value: (s) => s.openFlags, best: 'low' },
];

function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = (searchParams.get('ids') || '').split(',').filter((id) => id !== '');

  const [startups, setStartups] = useState<CompareStartup[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [shortlistName, setShortlistName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // reload whenever the selected ids change (e.g. after removing a startup)
  useEffect(() => {
    setLoading(true);
    setError('');
    apiRequest(`/startups/compare?ids=${ids.join(',')}`)
      .then((data) => setStartups(data.startups))
      .catch((err: Error) => {
        setStartups([]);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  // A1: removing a startup changes the URL, which redraws the table
  function removeStartup(id: number) {
    setMessage('');
    setSearchParams({ ids: ids.filter((i) => i !== String(id)).join(',') });
  }

  async function saveShortlist() {
    setError('');
    setMessage('');
    try {
      const data = await apiRequest('/startups/shortlists', 'POST', { name: shortlistName, ids });
      setMessage(data.message);
      setShortlistName('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // E1: a missing value shows "Not provided", never 0
  function showValue(metric: Metric, s: CompareStartup) {
    const value = metric.value(s);
    if (value === null || value === undefined) {
      if (metric.label.startsWith('Readiness') && s.ratings) {
        return 'Not assessed';
      }
      return 'Not provided';
    }
    return metric.format ? metric.format(s) : value.toLocaleString();
  }

  // best value in a row, so it can be highlighted
  function bestValue(metric: Metric) {
    const values = startups.map((s) => metric.value(s)).filter((v): v is number => typeof v === 'number');
    if (!metric.best || values.length < 2) return null;
    return metric.best === 'high' ? Math.max(...values) : Math.min(...values);
  }

  // sorted copy of the startups, missing values go last
  const sortMetric = METRICS.find((m) => m.label === sortBy);
  const columns = [...startups];
  if (sortMetric) {
    columns.sort((a, b) => {
      const x = sortMetric.value(a) as number | null;
      const y = sortMetric.value(b) as number | null;
      if (x === null) return 1;
      if (y === null) return -1;
      return sortMetric.best === 'low' ? x - y : y - x;
    });
  }

  return (
    <div>
      <h2>Compare Startups</h2>
      <p className="muted">
        All amounts are in PKR. The best value in each row is highlighted. <Link to="/startups">Back to shared startups</Link>
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      {loading && <p>Loading...</p>}

      {!loading && startups.length > 0 && (
        <>
          {sortMetric && (
            <p>
              Sorted by {sortMetric.label}.{' '}
              <button className="secondary" onClick={() => setSortBy('')}>Clear sort</button>
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {columns.map((s) => (
                  <th key={s.id}>
                    {s.companyName}
                    <div>
                      <Link to={`/startups/${s.id}`}>View</Link>{' '}
                      <button className="secondary" onClick={() => removeStartup(s.id)}>Remove</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => {
                const best = bestValue(metric);
                return (
                  <tr key={metric.label}>
                    <td>
                      {metric.label}{' '}
                      {metric.best && (
                        <button className="secondary" onClick={() => setSortBy(metric.label)}>Sort</button>
                      )}
                    </td>
                    {columns.map((s) => (
                      <td key={s.id} className={best !== null && metric.value(s) === best ? 'best' : ''}>
                        {showValue(metric, s)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="card">
            <h3>Save to shortlist</h3>
            <label htmlFor="shortlistName">Shortlist name</label>
            <input
              id="shortlistName"
              value={shortlistName}
              placeholder="e.g. Agritech seed round"
              onChange={(e) => setShortlistName(e.target.value)}
            />
            <button onClick={saveShortlist}>Save comparison</button>
          </div>
        </>
      )}
    </div>
  );
}

export default Compare;

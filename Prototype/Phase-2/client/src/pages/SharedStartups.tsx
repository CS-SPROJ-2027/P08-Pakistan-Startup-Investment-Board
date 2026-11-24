/**
 * UC-014: Investor dashboard listing the startups shared with the user's organisation.
 * Startups can be filtered by sector, stage, city and round size, and sorted.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest } from '../api';
import { SECTORS, STAGES, CITIES } from '../profileRules';

interface StartupRow {
  id: number;
  companyName: string;
  sector: string;
  stage: string;
  city: string;
  roundAmount: number;
  monthlyRevenue: number;
  sharedAt: string;
}

const emptyFilters = { sector: '', stage: '', city: '', minRound: '', maxRound: '', sort: 'newest' };

function SharedStartups() {
  const [filters, setFilters] = useState(emptyFilters);
  const [startups, setStartups] = useState<StartupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // message passed from the details page when access was removed
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;

  useEffect(() => {
    const query = new URLSearchParams(filters).toString();
    apiRequest(`/startups?${query}`)
      .then((data) => {
        setStartups(data.startups);
        setTotal(data.total);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function changeFilter(name: string, value: string) {
    setFilters({ ...filters, [name]: value });
  }

  // shows large PKR amounts with commas, e.g. 40,000,000
  function formatPkr(amount: number | null) {
    return amount === null || amount === undefined ? '-' : `PKR ${amount.toLocaleString()}`;
  }

  return (
    <div>
      <h2>Shared Startups</h2>
      <p className="muted">These startups have been shared with your organisation by their founders.</p>
      {notice && <p className="error">{notice}</p>}

      <div className="card filters">
        <div>
          <label htmlFor="sector">Sector</label>
          <select id="sector" value={filters.sector} onChange={(e) => changeFilter('sector', e.target.value)}>
            <option value="">All</option>
            {SECTORS.map((sector) => (
              <option key={sector}>{sector}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stage">Stage</label>
          <select id="stage" value={filters.stage} onChange={(e) => changeFilter('stage', e.target.value)}>
            <option value="">All</option>
            {STAGES.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="city">City</label>
          <select id="city" value={filters.city} onChange={(e) => changeFilter('city', e.target.value)}>
            <option value="">All</option>
            {CITIES.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="minRound">Min round (PKR)</label>
          <input id="minRound" type="number" min="0" value={filters.minRound} onChange={(e) => changeFilter('minRound', e.target.value)} />
        </div>
        <div>
          <label htmlFor="maxRound">Max round (PKR)</label>
          <input id="maxRound" type="number" min="0" value={filters.maxRound} onChange={(e) => changeFilter('maxRound', e.target.value)} />
        </div>
        <div>
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={filters.sort} onChange={(e) => changeFilter('sort', e.target.value)}>
            <option value="newest">Recently shared</option>
            <option value="round_high">Round size (high to low)</option>
            <option value="round_low">Round size (low to high)</option>
            <option value="name">Company name</option>
          </select>
        </div>
      </div>
      <button className="secondary" onClick={() => setFilters(emptyFilters)}>Clear filters</button>

      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <p>
            Showing {startups.length} of {total} startups
          </p>
          {total === 0 ? (
            <p className="muted">No startups have been shared with your organisation yet.</p>
          ) : startups.length === 0 ? (
            <p className="muted">No startups match these filters. Try changing or clearing them.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Sector</th>
                  <th>Stage</th>
                  <th>City</th>
                  <th>Raising</th>
                  <th>Monthly revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {startups.map((startup) => (
                  <tr key={startup.id}>
                    <td>{startup.companyName}</td>
                    <td>{startup.sector}</td>
                    <td>{startup.stage}</td>
                    <td>{startup.city || '-'}</td>
                    <td>{formatPkr(startup.roundAmount)}</td>
                    <td>{formatPkr(startup.monthlyRevenue)}</td>
                    <td>
                      <Link to={`/startups/${startup.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default SharedStartups;

/**
 * Home page.
 * Shows a short introduction and whether the backend is reachable.
 */
import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

function Home() {
  const [serverStatus, setServerStatus] = useState('checking...');

  useEffect(() => {
    apiRequest('/health')
      .then(() => setServerStatus('connected'))
      .catch((err) => setServerStatus(err.message));
  }, []);

  return (
    <div>
      <h1>Pakistan Startup Investment Board</h1>
      <p>
        PSIB helps founders present their startup in one standard format and lets investors
        and incubation centres review the startups shared with them.
      </p>
      <p className="muted">Server status: {serverStatus}</p>
    </div>
  );
}

export default Home;

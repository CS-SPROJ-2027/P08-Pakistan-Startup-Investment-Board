/**
 * UC-005 (E2): Quarantined files page for the administrator.
 * Files where malware was found are only listed here.
 */
import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

interface QuarantinedFile {
  id: number;
  doc_type: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  company_name: string | null;
}

function AdminQuarantine() {
  const [files, setFiles] = useState<QuarantinedFile[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/admin/quarantine')
      .then((data) => setFiles(data.files))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h2>Quarantined Files</h2>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {files.length === 0 ? (
          <p className="muted">No quarantined files.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Startup</th>
                <th>Type</th>
                <th>File</th>
                <th>Uploaded by</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td>{file.company_name || 'No name yet'}</td>
                  <td>{file.doc_type}</td>
                  <td>{file.file_name} ({Math.ceil(file.file_size / 1024)} KB)</td>
                  <td>{file.uploaded_by}</td>
                  <td>{new Date(file.uploaded_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminQuarantine;

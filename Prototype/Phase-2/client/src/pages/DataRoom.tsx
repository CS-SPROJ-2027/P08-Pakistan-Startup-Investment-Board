/**
 * UC-005: Data room page for founders.
 * The founder uploads documents, sees the list of files and
 * confirms or corrects any extracted values marked "Verify".
 */
import { useEffect, useState, FormEvent } from 'react';
import { apiRequest } from '../api';

interface Document {
  id: number;
  doc_type: string;
  file_name: string;
  file_size: number;
  version: number;
  status: string;
  extraction_status: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface Field {
  id: number;
  field_name: string;
  value: number;
  source: string;
  confidence: number;
  status: string;
  file_name: string;
}

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED = ['pdf', 'xlsx', 'docx'];

function DataRoom() {
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadPage() {
    try {
      const data = await apiRequest('/documents');
      setDocumentTypes(data.documentTypes);
      setDocuments(data.documents);
      setFields(data.fields);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    // same checks as the server, so the founder gets a quick message
    if (!docType) {
      return setError('Please select a document type');
    }
    if (!file) {
      return setError('Please choose a file to upload');
    }
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED.includes(extension)) {
      return setError('Only PDF, XLSX or DOCX files can be uploaded');
    }
    if (file.size > MAX_SIZE) {
      return setError('The file is larger than 25 MB');
    }

    const formData = new FormData();
    formData.append('docType', docType);
    formData.append('file', file);

    setUploading(true);
    try {
      const data = await apiRequest('/documents', 'POST', formData);
      setMessage(data.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      // clear the form and reload the list (a quarantined file also shows up)
      setUploading(false);
      setFile(null);
      setDocType('');
      setFileInputKey(fileInputKey + 1);
      loadPage();
    }
  }

  // The download needs the login token, so the file is fetched and then saved
  async function download(doc: Document) {
    setError('');
    const response = await fetch(`/api/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!response.ok) {
      return setError('Could not download the file');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function confirmValue(field: Field) {
    setError('');
    setMessage('');
    const value = corrections[field.id] ?? String(field.value);
    try {
      const data = await apiRequest(`/documents/fields/${field.id}/confirm`, 'POST', { value });
      setMessage(data.message);
      loadPage();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  const quarantined = documents.filter((d) => d.status === 'quarantined');

  return (
    <div>
      <h2>Data Room</h2>
      <p className="muted">Your documents are private. Files are scanned for malware and stored encrypted.</p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      {quarantined.length > 0 && (
        <p className="error">
          {quarantined.length} file(s) were quarantined because malware was found. Only the administrator can see them.
        </p>
      )}

      <form className="card" onSubmit={handleUpload}>
        <h3>Upload a document</h3>
        <label htmlFor="docType">Document type</label>
        <select id="docType" value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="">Select type</option>
          {documentTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <label htmlFor="file">File (PDF, XLSX or DOCX, max 25 MB)</label>
        <input
          key={fileInputKey}
          id="file"
          type="file"
          accept=".pdf,.xlsx,.docx"
          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        />

        <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
      </form>

      <div className="card">
        <h3>My documents</h3>
        {documents.length === 0 ? (
          <p className="muted">No documents uploaded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                <th>Version</th>
                <th>Uploaded by</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.doc_type}</td>
                  <td>{doc.file_name} ({Math.ceil(doc.file_size / 1024)} KB)</td>
                  <td>{doc.version}</td>
                  <td>{doc.uploaded_by}</td>
                  <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                  <td>
                    {doc.status === 'quarantined'
                      ? 'Quarantined'
                      : doc.extraction_status === 'extracted'
                        ? 'Extracted'
                        : 'Not yet extracted'}
                  </td>
                  <td>
                    {doc.status === 'stored' && (
                      <button className="secondary" onClick={() => download(doc)}>Download</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Extracted values</h3>
        {fields.length === 0 ? (
          <p className="muted">No values extracted yet. Upload a financial statement as an XLSX file.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
                <th>Source</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id}>
                  <td>{field.field_name}</td>
                  <td>
                    {field.status === 'verify' ? (
                      <div className="row">
                        <input
                          type="number"
                          min="0"
                          value={corrections[field.id] ?? String(field.value)}
                          onChange={(e) => setCorrections({ ...corrections, [field.id]: e.target.value })}
                        />
                        <button onClick={() => confirmValue(field)}>Confirm</button>
                      </div>
                    ) : (
                      field.value.toLocaleString()
                    )}
                  </td>
                  <td>{field.file_name}, {field.source}</td>
                  <td>{field.confidence}</td>
                  <td>
                    {field.status === 'verify' ? <strong>Verify</strong> : field.status === 'confirmed' ? 'Confirmed' : 'OK'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default DataRoom;

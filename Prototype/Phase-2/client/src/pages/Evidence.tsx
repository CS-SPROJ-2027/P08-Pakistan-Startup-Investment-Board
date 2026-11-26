/**
 * UC-016 (A1): Shows the spreadsheet a memo claim came from,
 * with the source cell highlighted.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';

interface Sheet {
  name: string;
  rows: string[][];
}

// "C3" -> { column: 2, row: 2 } (both counted from 0)
function parseAddress(address: string) {
  const letters = address.replace(/[0-9]/g, '');
  let column = 0;
  for (const letter of letters) {
    column = column * 26 + (letter.charCodeAt(0) - 64);
  }
  return { column: column - 1, row: Number(address.replace(/[A-Z]/g, '')) - 1 };
}

function Evidence() {
  const { id, documentId } = useParams();
  const [searchParams] = useSearchParams();
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [error, setError] = useState('');
  const highlighted = useRef<HTMLTableCellElement>(null);

  // the cell looks like "Income Statement!C3"
  const cell = searchParams.get('cell') || '';
  const sheetName = cell.slice(0, cell.lastIndexOf('!'));
  const target = parseAddress(cell.slice(cell.lastIndexOf('!') + 1));

  useEffect(() => {
    apiRequest(`/startups/${id}/documents/${documentId}`)
      .then((data) => {
        setFileName(data.fileName);
        setSheets(data.sheets);
      })
      .catch((err: Error) => setError(err.message));
  }, [id, documentId]);

  // scroll to the highlighted cell once the table is shown
  useEffect(() => {
    highlighted.current?.scrollIntoView({ block: 'center' });
  }, [sheets]);

  const sheet = sheets.find((s) => s.name === sheetName) || sheets[0];

  return (
    <div>
      <h2>Source: {fileName}</h2>
      <p className="muted">
        Sheet "{sheetName}", cell {cell.slice(cell.lastIndexOf('!') + 1)} is highlighted.{' '}
        <Link to={`/startups/${id}/memo`}>Back to memo</Link>
      </p>
      {error && <p className="error">{error}</p>}

      {sheet && (
        <table>
          <thead>
            <tr>
              <th></th>
              {sheet.rows[0]?.map((_, c) => (
                <th key={c}>{String.fromCharCode(65 + c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {row.map((value, c) => {
                  const isTarget = sheet.name === sheetName && r === target.row && c === target.column;
                  return (
                    <td key={c} className={isTarget ? 'evidence' : ''} ref={isTarget ? highlighted : null}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Evidence;

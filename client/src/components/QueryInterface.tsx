import { FormEvent, useState } from 'react';

// Shape returned by POST /query once Part 3 is implemented.
interface QueryResult {
  answer: string;
  sql: string;
  rows: Record<string, unknown>[];
}

// TODO (Part 3): This component is intentionally plain. Wire it to the real
// endpoint (already done below), then improve it however you see fit — styling,
// empty/loading states, formatting of the SQL and result table, etc.
export default function QueryInterface() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notImplemented, setNotImplemented] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setNotImplemented(false);
    setResult(null);

    try {
      // The Vite dev server proxies /api -> the NestJS API (see vite.config.ts).
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 501) {
        // Part 3 isn't implemented yet — surface the API's helpful message.
        setNotImplemented(true);
        setError(data?.message ?? 'POST /query is not implemented yet.');
        return;
      }

      if (!res.ok) {
        setError(data?.message ?? `Request failed (${res.status}).`);
        return;
      }

      setResult(data as QueryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const columns =
    result?.rows && result.rows.length > 0 ? Object.keys(result.rows[0]) : [];

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How many sessions happened in the last 30 days?"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {/* Loading state */}
      {loading && <p className="text-sm text-gray-500">Running your question…</p>}

      {/* Error / not-implemented state */}
      {error && (
        <div
          className={`rounded border px-4 py-3 text-sm ${
            notImplemented
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}
        >
          {notImplemented && (
            <p className="mb-1 font-medium">Not implemented yet</p>
          )}
          <p>{error}</p>
        </div>
      )}

      {/* Result state */}
      {result && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Answer
            </h2>
            <p className="text-sm">{result.answer}</p>
          </div>

          <details className="rounded border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-400">
              Generated SQL
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
              {result.sql}
            </pre>
          </details>

          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Rows ({result.rows?.length ?? 0})
            </h2>
            {columns.length === 0 ? (
              <p className="text-sm text-gray-500">No rows returned.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      {columns.map((c) => (
                        <th key={c} className="px-2 py-1 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {columns.map((c) => (
                          <td key={c} className="px-2 py-1">
                            {String(row[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

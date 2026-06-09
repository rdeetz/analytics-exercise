import QueryInterface from './components/QueryInterface';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <h1 className="text-lg font-semibold">Blueprint Analytics</h1>
          <p className="text-sm text-gray-500">
            Ask a plain-English question about the data.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <QueryInterface />
      </main>
    </div>
  );
}

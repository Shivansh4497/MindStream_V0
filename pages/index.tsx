import { useState } from 'react'

export default function Home() {
  const [input, setInput] = useState('')

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-start justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-indigo-900">Mindstream</h1>
          <p className="text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        {/* Privacy modal placeholder */}
        <div className="mb-4 p-4 rounded-lg border border-slate-100 bg-white shadow-sm">
          <strong>Privacy:</strong> Your thoughts are encrypted and private. (Privacy modal will show on first login)
        </div>

        {/* Input bar */}
        <div className="mb-6">
          <label className="sr-only">New thought</label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="What’s on your mind?"
            />
            <button
              onClick={() => { setInput(''); alert('Saved (demo)') }}
              className="rounded-md bg-indigo-700 text-white px-4 py-2"
            >
              Save
            </button>
          </div>
        </div>

        {/* Stream placeholder */}
        <section className="space-y-4">
          <div className="text-sm text-slate-500">Today — Auto summary (10 PM)</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            <div className="text-slate-700">No entries yet — your thoughts will appear here once you start typing.</div>
          </div>
        </section>

      </div>
    </main>
  )
}

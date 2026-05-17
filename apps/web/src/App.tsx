import { BrowserRouter, Routes, Route } from 'react-router-dom'
import GamePage from './pages/GamePage'

function HomePage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-3xl font-bold text-slate-900">Rune Race</h1>
        <p className="mt-2 text-sm text-slate-600">Board viewport milestone</p>
        <a
          href="/game"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-800"
        >
          Open Game Viewport
        </a>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

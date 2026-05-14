import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import DemoPage from './pages/DemoPage'

function HomePage() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Rune Race</h1>
        <p className="text-gray-600 mb-8">Welcome to the game</p>
        <button
          onClick={() => setCount(count + 1)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          Count is: {count}
        </button>
        <p className="text-gray-600 text-sm mt-8">App is running ✨</p>
        <a href="/demo" className="block mt-6 text-blue-600 hover:text-blue-800 font-semibold">
          → Go to 3D Demo
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
        <Route path="/demo" element={<DemoPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

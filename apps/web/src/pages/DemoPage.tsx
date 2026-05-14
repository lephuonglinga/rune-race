import { Link } from 'react-router-dom'
import DemoScene from '../components/DemoScene'

export default function DemoPage() {
  return (
    <div className="w-full h-screen bg-gray-900 relative">
      <DemoScene />
      <div className="absolute top-4 left-4 z-10">
        <Link
          to="/"
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          ← Back to Home
        </Link>
      </div>
      <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-70 text-white p-4 rounded">
        <p className="text-sm">Three.js + React Three Fiber Demo</p>
        <p className="text-xs mt-2">Loading random 3D assets from /assets/</p>
      </div>
    </div>
  )
}

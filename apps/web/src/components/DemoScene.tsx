import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense } from 'react'
import DemoModel from './DemoModel'

// Asset list - GLTF models that are lightweight
const ASSETS = [
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/D6_A_blue.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/D6_A_green.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/D6_A_red.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/coin_gold.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/coin_silver.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/cube_blue.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/cube_gold.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/cube_red.gltf',
  '/assets/KayKit_BoardGameBits_1.0_FREE/Assets/gltf/container_A.gltf',
]

function getRandomAssets(count: number) {
  const shuffled = [...ASSETS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export default function DemoScene() {
  const selectedAssets = getRandomAssets(5)

  return (
    <Canvas className="w-full h-full">
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 5, 8]} fov={75} />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <pointLight position={[-5, 5, 5]} intensity={0.4} color="#ff9ff3" />

      {/* Models */}
      <Suspense
        fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="gray" />
          </mesh>
        }
      >
        {selectedAssets.map((asset, idx) => (
          <DemoModel key={`${asset}-${idx}`} path={asset} position={getRandomPosition(idx)} />
        ))}
      </Suspense>

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {/* Controls */}
      <OrbitControls enableZoom enablePan enableRotate autoRotate autoRotateSpeed={2} />
    </Canvas>
  )
}

function getRandomPosition(index: number): [number, number, number] {
  const radius = 3
  const angle = (index / 5) * Math.PI * 2
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  const y = Math.random() * 1
  return [x, y, z]
}

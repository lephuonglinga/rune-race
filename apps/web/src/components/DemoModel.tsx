import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

interface DemoModelProps {
  path: string
  position: [number, number, number]
}

export default function DemoModel({ path, position }: DemoModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { scene } = useGLTF(path)

  // Auto-rotate animation
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.01
      groupRef.current.rotation.x += 0.005
    }
  })

  return (
    <group ref={groupRef} position={position} castShadow receiveShadow>
      <primitive object={scene.clone()} scale={1} />
    </group>
  )
}

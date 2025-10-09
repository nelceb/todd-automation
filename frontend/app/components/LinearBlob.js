'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function Blob() {
  const meshRef = useRef()
  const materialRef = useRef()

  // Create a blob-like geometry using sphere with noise
  const geometry = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 64, 64)
    return sphere
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Animate the blob deformation
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1
      meshRef.current.rotation.y = time * 0.2
      meshRef.current.position.z = Math.sin(time * 0.5) * 0.5
    }

    // Animate the material colors
    if (materialRef.current) {
      const hue = (time * 0.1) % 1
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6)
      materialRef.current.color = color
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <MeshDistortMaterial
        ref={materialRef}
        color="#8B5CF6"
        metalness={0.8}
        roughness={0.2}
        distort={0.4}
        speed={2}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

export default function LinearBlob() {
  return (
    <div className="w-full h-64 relative overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        <Blob />
      </Canvas>
    </div>
  )
}

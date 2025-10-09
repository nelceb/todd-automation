'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function WireframeCube({ position = [0, 0, 0], delay = 0 }) {
  const meshRef = useRef()
  const materialRef = useRef()

  // Create wireframe cube geometry
  const geometry = useMemo(() => {
    const cube = new THREE.BoxGeometry(1.2, 1.2, 1.2, 6, 6, 6)
    return cube
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime() + delay
    
    // Animate the cube rotation and position
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(time * 0.4) * 0.3 + time * 0.1
      meshRef.current.rotation.y = time * 0.3
      meshRef.current.rotation.z = Math.sin(time * 0.2) * 0.2
      meshRef.current.position.y = position[1] + Math.sin(time * 0.6) * 0.2
    }

    // Animate the material colors and distortion
    if (materialRef.current) {
      const hue = (time * 0.15) % 1
      const color = new THREE.Color().setHSL(hue, 0.9, 0.7)
      materialRef.current.color = color
      materialRef.current.distort = Math.sin(time * 0.8) * 0.3 + 0.5
    }
  })

  return (
    <mesh ref={meshRef} position={position} geometry={geometry}>
      <MeshDistortMaterial
        ref={materialRef}
        color="#00FF88"
        metalness={0.1}
        roughness={0.1}
        distort={0.5}
        speed={1.5}
        transparent
        opacity={0.9}
        wireframe={true}
      />
    </mesh>
  )
}

export default function LinearBlob() {
  return (
    <div className="w-full h-64 relative overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <pointLight position={[-5, -5, -5]} intensity={0.4} />
        
        {/* Multiple wireframe cubes with different positions and delays */}
        <WireframeCube position={[0, 0, 0]} delay={0} />
        <WireframeCube position={[2.5, 0, 0]} delay={0.5} />
        <WireframeCube position={[-2.5, 0, 0]} delay={1} />
        <WireframeCube position={[0, 2.5, 0]} delay={1.5} />
        <WireframeCube position={[0, -2.5, 0]} delay={2} />
        <WireframeCube position={[1.25, 1.25, 0]} delay={2.5} />
      </Canvas>
    </div>
  )
}

'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function AnimatedCube() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    if (meshRef.current) {
      // Animate rotation with slow, lunar-like movement
      const rotationSpeed = 0.05 + Math.sin(time * 0.2) * 0.02 // Much slower, more subtle variation
      meshRef.current.rotation.x = time * rotationSpeed
      meshRef.current.rotation.y = time * (rotationSpeed + 0.01) // Minimal difference between axes
      meshRef.current.rotation.z = time * (rotationSpeed - 0.01)
    }

    // Animate the material colors with smooth transitions
    if (materialRef.current) {
      const hue = (time * 0.05) % 1
      const color = new THREE.Color().setHSL(hue, 0.8, 0.7)
      materialRef.current.color = color
    }
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <MeshDistortMaterial
        ref={materialRef}
        color="#8B5CF6"
        metalness={0.2}
        roughness={0.1}
        distort={0.15}
        speed={1.5}
        transparent
        opacity={0.8}
        wireframe={false}
      />
    </mesh>
  )
}

export default function SmallCube() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 45 }}
        style={{ 
          background: 'transparent', 
          width: '100%', 
          height: '100%'
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 2]} intensity={0.8} />
        
        {/* Animated cube */}
        <AnimatedCube />
      </Canvas>
    </div>
  )
}

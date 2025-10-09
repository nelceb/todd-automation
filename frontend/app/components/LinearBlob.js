'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function WireframeCube() {
  const meshRef = useRef()
  const materialRef = useRef()

  // Create wireframe cube geometry - optimized for wider space
  const geometry = useMemo(() => {
    const cube = new THREE.BoxGeometry(2.2, 2.2, 2.2, 8, 8, 8)
    return cube
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Animate the cube rotation - smooth and elegant, keep position fixed
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.2 + time * 0.1
      meshRef.current.rotation.y = time * 0.2
      meshRef.current.rotation.z = Math.sin(time * 0.15) * 0.1
      // Keep position fixed to prevent size changes
      meshRef.current.position.set(0, 0, 0)
    }

    // Animate the material colors - slower, more elegant transitions
    if (materialRef.current) {
      const hue = (time * 0.08) % 1
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6)
      materialRef.current.color = color
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <MeshDistortMaterial
        ref={materialRef}
        color="#8B5CF6"
        metalness={0.1}
        roughness={0.1}
        distort={0.2}
        speed={1}
        transparent
        opacity={0.8}
        wireframe={true}
      />
    </mesh>
  )
}

export default function LinearBlob() {
  return (
    <div className="w-full h-64 relative overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        style={{ background: 'transparent', width: '100%', height: '100%', minWidth: '400px' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 3, 3]} intensity={1} />
        <pointLight position={[-3, -3, -3]} intensity={0.3} />
        
        {/* Single large wireframe cube */}
        <WireframeCube />
      </Canvas>
    </div>
  )
}

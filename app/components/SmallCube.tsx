'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface AnimatedCubeProps {
  speedMultiplier?: number
}

function AnimatedCube({ speedMultiplier = 1 }: AnimatedCubeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    if (meshRef.current) {
      // Faster rotation - increased base speed significantly
      // speedMultiplier affects rotation speed (default 1, higher = faster)
      const baseRotationSpeed = 0.3 // Increased from 0.05 to 0.3 (6x faster)
      const rotationSpeed = baseRotationSpeed * speedMultiplier
      meshRef.current.rotation.x = time * rotationSpeed
      meshRef.current.rotation.y = time * (rotationSpeed + 0.02)
      meshRef.current.rotation.z = time * (rotationSpeed - 0.02)
    }

    // Animate the wireframe color with smooth transitions
    if (materialRef.current) {
      const hue = (time * 0.1 * speedMultiplier) % 1
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6)
      materialRef.current.color = color
    }
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#8B5CF6"
        wireframe={true}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

interface SmallCubeProps {
  speedMultiplier?: number
}

export default function SmallCube({ speedMultiplier = 1 }: SmallCubeProps) {
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
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 2, 2]} intensity={1.0} />
        
        {/* Animated cube */}
        <AnimatedCube speedMultiplier={speedMultiplier} />
      </Canvas>
    </div>
  )
}

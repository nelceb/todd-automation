'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface AnimatedCubeProps {
  speedMultiplier?: number
}

function AnimatedCube({ speedMultiplier = 1 }: AnimatedCubeProps) {
  const meshRef = useRef<THREE.Mesh>(null)

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
  })

  return (
    <mesh ref={meshRef}>
      {/* Square mesh - all dimensions equal */}
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color="#000000"
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

'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function MorphingShape() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)

  // Create geometries for different shapes
  const geometries = useMemo(() => {
    return {
      cube: new THREE.BoxGeometry(0.8, 0.8, 0.8, 6, 6, 6),
      triangle: new THREE.ConeGeometry(0.6, 1.2, 3),
      circle: new THREE.SphereGeometry(0.6, 16, 16)
    }
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Morph between shapes every 3 seconds
    const morphTime = (time % 9) / 9 // 0 to 1 over 9 seconds (3 seconds per shape)
    let currentGeometry
    
    if (morphTime < 0.33) {
      // First 3 seconds: Cube
      currentGeometry = geometries.cube
    } else if (morphTime < 0.66) {
      // Next 3 seconds: Triangle
      currentGeometry = geometries.triangle
    } else {
      // Last 3 seconds: Circle
      currentGeometry = geometries.circle
    }
    
    // Update geometry
    if (meshRef.current) {
      meshRef.current.geometry = currentGeometry
      
      // Animate rotation - different speeds for different shapes
      const rotationSpeed = morphTime < 0.33 ? 0.3 : morphTime < 0.66 ? 0.5 : 0.4
      meshRef.current.rotation.x = time * rotationSpeed
      meshRef.current.rotation.y = time * (rotationSpeed + 0.1)
      meshRef.current.rotation.z = time * (rotationSpeed - 0.1)
    }

    // Animate the material colors - subtle transitions
    if (materialRef.current) {
      const hue = (time * 0.1) % 1
      const color = new THREE.Color().setHSL(hue, 0.7, 0.6)
      materialRef.current.color = color
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometries.cube}>
      <MeshDistortMaterial
        ref={materialRef}
        color="#8B5CF6"
        metalness={0.1}
        roughness={0.1}
        distort={0.1}
        speed={1}
        transparent
        opacity={0.9}
        wireframe={true}
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
        
        {/* Morphing shape: cube → triangle → circle */}
        <MorphingShape />
      </Canvas>
    </div>
  )
}

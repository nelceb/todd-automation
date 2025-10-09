'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function SmallWireframeCube() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)

  // Create small wireframe cube geometry
  const geometry = useMemo(() => {
    const cube = new THREE.BoxGeometry(0.8, 0.8, 0.8, 6, 6, 6)
    return cube
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Animate the cube rotation - smooth and elegant
    if (meshRef.current) {
      meshRef.current.rotation.x = time * 0.3
      meshRef.current.rotation.y = time * 0.4
      meshRef.current.rotation.z = time * 0.2
    }

    // Animate the material colors - subtle transitions
    if (materialRef.current) {
      const hue = (time * 0.1) % 1
      const color = new THREE.Color().setHSL(hue, 0.7, 0.6)
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
        
        {/* Small wireframe cube */}
        <SmallWireframeCube />
      </Canvas>
    </div>
  )
}

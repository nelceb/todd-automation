'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function MorphingShape() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<any>(null)
  const morphGeometryRef = useRef<THREE.BufferGeometry>(null)

  // Create base geometries for morphing
  const baseGeometries = useMemo(() => {
    const cube = new THREE.BoxGeometry(0.8, 0.8, 0.8, 8, 8, 8)
    const triangle = new THREE.ConeGeometry(0.6, 1.2, 8)
    const circle = new THREE.SphereGeometry(0.6, 16, 16)
    
    // Normalize geometries to have the same number of vertices
    const targetVertices = 1000 // Target number of vertices
    
    return {
      cube: normalizeGeometry(cube, targetVertices),
      triangle: normalizeGeometry(triangle, targetVertices),
      circle: normalizeGeometry(circle, targetVertices)
    }
  }, [])

  // Function to normalize geometry to have the same number of vertices
  function normalizeGeometry(geometry: THREE.BufferGeometry, targetVertices: number): THREE.BufferGeometry {
    const positions = geometry.attributes.position.array as Float32Array
    const normalizedGeometry = new THREE.BufferGeometry()
    
    // Create a new position array with target number of vertices
    const newPositions = new Float32Array(targetVertices * 3)
    
    // Interpolate between existing vertices to reach target count
    for (let i = 0; i < targetVertices; i++) {
      const sourceIndex = (i / (targetVertices - 1)) * (positions.length / 3 - 1)
      const index1 = Math.floor(sourceIndex)
      const index2 = Math.min(index1 + 1, positions.length / 3 - 1)
      const t = sourceIndex - index1
      
      // Interpolate between two vertices
      newPositions[i * 3] = positions[index1 * 3] * (1 - t) + positions[index2 * 3] * t
      newPositions[i * 3 + 1] = positions[index1 * 3 + 1] * (1 - t) + positions[index2 * 3 + 1] * t
      newPositions[i * 3 + 2] = positions[index1 * 3 + 2] * (1 - t) + positions[index2 * 3 + 2] * t
    }
    
    normalizedGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))
    return normalizedGeometry
  }

  // Initialize morphing geometry
  useEffect(() => {
    if (meshRef.current && !morphGeometryRef.current) {
      const morphGeometry = new THREE.BufferGeometry()
      morphGeometry.copy(baseGeometries.cube)
      morphGeometryRef.current = morphGeometry
      meshRef.current.geometry = morphGeometry
    }
  }, [baseGeometries])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Morph between shapes every 4 seconds (12 seconds total cycle)
    const cycleTime = (time % 12) / 12 // 0 to 1 over 12 seconds
    let morphProgress = 0
    let fromGeometry: THREE.BufferGeometry
    let toGeometry: THREE.BufferGeometry
    
    if (cycleTime < 0.33) {
      // Cube to Triangle (0-4 seconds)
      morphProgress = (cycleTime / 0.33)
      fromGeometry = baseGeometries.cube
      toGeometry = baseGeometries.triangle
    } else if (cycleTime < 0.66) {
      // Triangle to Circle (4-8 seconds)
      morphProgress = ((cycleTime - 0.33) / 0.33)
      fromGeometry = baseGeometries.triangle
      toGeometry = baseGeometries.circle
    } else {
      // Circle to Cube (8-12 seconds)
      morphProgress = ((cycleTime - 0.66) / 0.34)
      fromGeometry = baseGeometries.circle
      toGeometry = baseGeometries.cube
    }
    
    // Smooth morphing using easing function
    const smoothProgress = easeInOutCubic(morphProgress)
    
    // Interpolate between geometries
    if (meshRef.current && morphGeometryRef.current) {
      const positions = morphGeometryRef.current.attributes.position.array as Float32Array
      const fromPositions = fromGeometry.attributes.position.array as Float32Array
      const toPositions = toGeometry.attributes.position.array as Float32Array
      
      // Interpolate each vertex
      for (let i = 0; i < positions.length; i++) {
        positions[i] = fromPositions[i] * (1 - smoothProgress) + toPositions[i] * smoothProgress
      }
      
      morphGeometryRef.current.attributes.position.needsUpdate = true
      
      // Animate rotation with varying speeds
      const rotationSpeed = 0.3 + Math.sin(time * 0.5) * 0.1
      meshRef.current.rotation.x = time * rotationSpeed
      meshRef.current.rotation.y = time * (rotationSpeed + 0.1)
      meshRef.current.rotation.z = time * (rotationSpeed - 0.1)
    }

    // Animate the material colors with smooth transitions
    if (materialRef.current) {
      const hue = (time * 0.05) % 1
      const color = new THREE.Color().setHSL(hue, 0.8, 0.7)
      materialRef.current.color = color
    }
  })

  // Easing function for smooth transitions
  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  return (
    <mesh ref={meshRef}>
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
        
        {/* Morphing shape: cube → triangle → circle */}
        <MorphingShape />
      </Canvas>
    </div>
  )
}

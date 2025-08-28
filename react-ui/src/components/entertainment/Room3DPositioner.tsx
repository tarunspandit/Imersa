import React, { useRef, useState, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Grid, 
  Text,
  Box,
  Sphere,
  Environment,
  Float,
  Line
} from '@react-three/drei';
import * as THREE from 'three';
import { Sparkles, Move3d, RotateCw, ZoomIn, Tv } from 'lucide-react';
import '@/styles/design-system.css';

interface LightPosition {
  lightId: string;
  lightName: string;
  x: number;
  y: number;
  z: number;
}

interface Room3DPositionerProps {
  lights: LightPosition[];
  roomDimensions?: { width: number; height: number; depth: number };
  onUpdatePosition: (lightId: string, position: { x: number; y: number; z: number }) => void;
  onAutoArrange?: () => void;
  configurationType: 'screen' | '3dspace';
}

// Individual Light component in 3D space
const Light3D: React.FC<{
  light: LightPosition;
  isSelected: boolean;
  onSelect: (lightId: string) => void;
  onDrag: (position: THREE.Vector3) => void;
  roomDimensions: { width: number; height: number; depth: number };
}> = ({ light, isSelected, onSelect, onDrag, roomDimensions }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hover, setHover] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      // Floating animation for selected light
      if (isSelected) {
        meshRef.current.position.y = light.y + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      }
      
      // Glow effect
      if (hover || isSelected) {
        meshRef.current.scale.setScalar(1.2);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect(light.lightId);
    setIsDragging(true);
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // release capture if supported
    try { (meshRef.current as any)?.releasePointerCapture && (meshRef.current as any).releasePointerCapture(); } catch {}
  };

  const handlePointerMove = (e: any) => {
    if (isDragging) {
      e.stopPropagation();
      // Project pointer ray onto a horizontal plane at current Y
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -light.y);
      const intersection = new THREE.Vector3();
      if (e.ray && e.ray.intersectPlane(plane, intersection)) {
        // Clamp within room bounds
        const halfW = roomDimensions.width / 2;
        const halfD = roomDimensions.depth / 2;
        const height = roomDimensions.height;
        intersection.x = Math.max(-halfW, Math.min(halfW, intersection.x));
        intersection.y = Math.max(0, Math.min(height, intersection.y));
        intersection.z = Math.max(-halfD, Math.min(halfD, intersection.z));
        onDrag(intersection);
      }
    }
  };

  return (
    <group position={[light.x, light.y, light.z]}>
      <Sphere
        ref={meshRef}
        args={[0.15, 32, 32]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <meshStandardMaterial
          color={isSelected ? '#ffd700' : hover ? '#ffa500' : '#ffffff'}
          emissive={isSelected ? '#ffd700' : hover ? '#ffa500' : '#ffcc00'}
          emissiveIntensity={isSelected ? 0.8 : hover ? 0.5 : 0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>
      
      {/* Light glow effect */}
      <pointLight
        color={isSelected ? '#ffd700' : '#ffffff'}
        intensity={isSelected ? 2 : 1}
        distance={2}
        decay={2}
      />
      
      {/* Label */}
      <Text
        position={[0, 0.3, 0]}
        fontSize={0.15}
        color={isSelected ? '#ffd700' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {light.lightName}
      </Text>
    </group>
  );
};

// Room walls and TV/Screen
const Room3D: React.FC<{
  dimensions: { width: number; height: number; depth: number };
  configurationType: 'screen' | '3dspace';
}> = ({ dimensions, configurationType }) => {
  const { width, height, depth } = dimensions;

  return (
    <>
      {/* Floor */}
      <Box args={[width, 0.1, depth]} position={[0, -0.05, 0]}>
        <meshStandardMaterial color="#1a1a2e" opacity={0.8} transparent />
      </Box>

      {/* Back wall */}
      <Box args={[width, height, 0.1]} position={[0, height / 2, -depth / 2]}>
        <meshStandardMaterial color="#16213e" opacity={0.5} transparent />
      </Box>

      {/* Left wall */}
      <Box args={[0.1, height, depth]} position={[-width / 2, height / 2, 0]}>
        <meshStandardMaterial color="#16213e" opacity={0.3} transparent />
      </Box>

      {/* Right wall */}
      <Box args={[0.1, height, depth]} position={[width / 2, height / 2, 0]}>
        <meshStandardMaterial color="#16213e" opacity={0.3} transparent />
      </Box>

      {/* TV/Screen for screen mode */}
      {configurationType === 'screen' && (
        <group position={[0, height / 2, -depth / 2 + 0.1]}>
          {/* TV Frame */}
          <Box args={[3, 1.7, 0.1]}>
            <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
          </Box>
          {/* TV Screen */}
          <Box args={[2.8, 1.5, 0.05]} position={[0, 0, 0.05]}>
            <meshStandardMaterial 
              color="#111111" 
              emissive="#0066ff"
              emissiveIntensity={0.2}
              metalness={0.5}
              roughness={0.8}
            />
          </Box>
          {/* TV Stand */}
          <Box args={[0.3, 0.5, 0.2]} position={[0, -1, 0]}>
            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
          </Box>
        </group>
      )}

      {/* Grid lines on floor */}
      <Grid 
        args={[width, depth]} 
        position={[0, 0.01, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#444444"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#666666"
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
      />
    </>
  );
};

// Main Room3D Positioner Component
export const Room3DPositioner: React.FC<Room3DPositionerProps> = ({
  lights,
  roomDimensions = { width: 10, height: 3, depth: 10 },
  onUpdatePosition,
  onAutoArrange,
  configurationType
}) => {
  const [selectedLight, setSelectedLight] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([8, 5, 8]);

  const handleLightDrag = (lightId: string, position: THREE.Vector3) => {
    onUpdatePosition(lightId, {
      x: position.x,
      y: position.y,
      z: position.z
    });
  };

  const handleResetView = () => {
    setCameraPosition([8, 5, 8]);
  };

  const handleTopView = () => {
    setCameraPosition([0, 10, 0.1]);
  };

  const handleFrontView = () => {
    setCameraPosition([0, 2, 10]);
  };

  const handleSideView = () => {
    setCameraPosition([10, 2, 0]);
  };

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <Move3d className="w-5 h-5 text-imersa-glow-primary" />
          3D Position Editor
        </h3>
        
        <div className="flex gap-2">
          {/* View presets */}
          <button
            onClick={handleFrontView}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm transition-all"
            title="Front View"
          >
            Front
          </button>
          <button
            onClick={handleSideView}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm transition-all"
            title="Side View"
          >
            Side
          </button>
          <button
            onClick={handleTopView}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm transition-all"
            title="Top View"
          >
            Top
          </button>
          <button
            onClick={handleResetView}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm transition-all flex items-center gap-1"
            title="Reset View"
          >
            <RotateCw className="w-3 h-3" />
            Reset
          </button>
          
          {onAutoArrange && (
            <button
              onClick={onAutoArrange}
              className="btn-glow text-sm flex items-center gap-2"
            >
              <Sparkles className="w-3 h-3" />
              Auto-Arrange
            </button>
          )}
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="relative w-full h-[500px] bg-imersa-void rounded-xl overflow-hidden border border-white/10">
        <Canvas shadows camera={{ position: cameraPosition, fov: 50 }}>
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.3} />
            <directionalLight
              position={[5, 5, 5]}
              intensity={0.5}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-5, 5, -5]} intensity={0.3} />
            
            {/* Environment */}
            <Environment preset="night" />
            
            {/* Room */}
            <Room3D dimensions={roomDimensions} configurationType={configurationType} />
            
            {/* Lights */}
            {lights.map(light => (
              <Light3D
                key={light.lightId}
                light={light}
                isSelected={selectedLight === light.lightId}
                onSelect={setSelectedLight}
                onDrag={(position) => handleLightDrag(light.lightId, position)}
                roomDimensions={roomDimensions}
              />
            ))}
            
            {/* Camera Controls */}
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              maxPolarAngle={Math.PI * 0.9}
              minDistance={2}
              maxDistance={20}
              target={[0, 1, 0]}
            />
          </Suspense>
        </Canvas>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 glass-card p-3 max-w-xs">
          <p className="text-xs text-gray-300">
            <span className="text-imersa-glow-primary">Click</span> to select • 
            <span className="text-imersa-glow-primary"> Drag</span> to move • 
            <span className="text-imersa-glow-primary"> Scroll</span> to zoom • 
            <span className="text-imersa-glow-primary"> Right-click + drag</span> to rotate
          </p>
        </div>

        {/* Selected light info */}
        {selectedLight && (
          <div className="absolute top-4 right-4 glass-card p-3">
            <p className="text-sm text-white font-medium mb-2">
              Selected: {lights.find(l => l.lightId === selectedLight)?.lightName}
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <div>X: {lights.find(l => l.lightId === selectedLight)?.x.toFixed(2)}</div>
              <div>Y: {lights.find(l => l.lightId === selectedLight)?.y.toFixed(2)}</div>
              <div>Z: {lights.find(l => l.lightId === selectedLight)?.z.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Position Grid (2D representation) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {lights.map(light => (
          <div key={light.lightId} className="glass-card p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white font-medium">{light.lightName}</span>
              <div className="text-xs text-gray-400">
                ({light.x.toFixed(1)}, {light.y.toFixed(1)}, {light.z.toFixed(1)})
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Room3DPositioner;

"use client";

import React, { Suspense, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stage, useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ----------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------

export interface CarModel3DProps {
  damagedParts: string[];
  onChange: (parts: string[]) => void;
}

const EXTERIOR_CHECKPOINTS = [
  // Front
  { id: "front_bumper", label: "Front Bumper", position: [0, 0.4, 2.2] },
  { id: "grille", label: "Front Grille", position: [0, 0.7, 2.2] },
  { id: "left_headlight", label: "Left Headlight", position: [0.7, 0.7, 2.1] },
  { id: "right_headlight", label: "Right Headlight", position: [-0.7, 0.7, 2.1] },
  { id: "hood", label: "Hood", position: [0, 0.9, 1.5] },
  { id: "windshield", label: "Windshield", position: [0, 1.3, 0.9] },
  
  // Left Side
  { id: "left_front_wheel", label: "Left Front Wheel", position: [0.9, 0.3, 1.3] },
  { id: "left_fender", label: "Left Fender", position: [1.0, 0.7, 1.3] },
  { id: "left_front_door", label: "Left Front Door", position: [1.0, 0.7, 0.5] },
  { id: "left_rear_door", label: "Left Rear Door", position: [1.0, 0.7, -0.5] },
  { id: "left_rear_wheel", label: "Left Rear Wheel", position: [0.9, 0.3, -1.3] },
  { id: "left_rear_quarter", label: "Left Quarter Panel", position: [1.0, 0.7, -1.5] },

  // Right Side
  { id: "right_front_wheel", label: "Right Front Wheel", position: [-0.9, 0.3, 1.3] },
  { id: "right_fender", label: "Right Fender", position: [-1.0, 0.7, 1.3] },
  { id: "right_front_door", label: "Right Front Door", position: [-1.0, 0.7, 0.5] },
  { id: "right_rear_door", label: "Right Rear Door", position: [-1.0, 0.7, -0.5] },
  { id: "right_rear_wheel", label: "Right Rear Wheel", position: [-0.9, 0.3, -1.3] },
  { id: "right_rear_quarter", label: "Right Quarter Panel", position: [-1.0, 0.7, -1.5] },

  // Roof & Rear
  { id: "roof", label: "Roof", position: [0, 1.7, 0] },
  { id: "rear_windshield", label: "Rear Window", position: [0, 1.3, -1.2] },
  { id: "trunk", label: "Trunk / Tailgate", position: [0, 0.9, -2.0] },
  { id: "left_taillight", label: "Left Taillight", position: [0.7, 0.8, -2.1] },
  { id: "right_taillight", label: "Right Taillight", position: [-0.7, 0.8, -2.1] },
  { id: "rear_bumper", label: "Rear Bumper", position: [0, 0.5, -2.2] },
];

const INTERIOR_CHECKPOINTS = [
  // Front Cabin
  { id: "steering_wheel", label: "Steering Wheel", position: [0.4, 1.0, 0.6] },
  { id: "dashboard", label: "Dashboard", position: [0, 1.0, 0.8] },
  { id: "ac_vents", label: "AC Vents", position: [0, 1.1, 0.7] },
  { id: "infotainment", label: "Infotainment / Radio", position: [0, 1.0, 0.6] },
  { id: "glove_box", label: "Glove Box", position: [-0.4, 0.8, 0.8] },
  
  // Seats & Belts
  { id: "driver_seat", label: "Driver Seat", position: [0.4, 0.6, 0.2] },
  { id: "passenger_seat", label: "Passenger Seat", position: [-0.4, 0.6, 0.2] },
  { id: "driver_seatbelt", label: "Driver Seatbelt", position: [0.6, 0.9, 0.2] },
  { id: "passenger_seatbelt", label: "Passenger Seatbelt", position: [-0.6, 0.9, 0.2] },
  
  // Rear Cabin
  { id: "rear_seats", label: "Rear Seats", position: [0, 0.6, -0.8] },
  { id: "rear_seatbelts", label: "Rear Seatbelts", position: [0, 0.9, -0.8] },
  { id: "rear_ac_vents", label: "Rear AC Vents", position: [0, 0.7, -0.2] },

  // Floors & Doors
  { id: "front_floor_mats", label: "Front Floor Mats", position: [0, 0.2, 0.5] },
  { id: "rear_floor_mats", label: "Rear Floor Mats", position: [0, 0.2, -0.5] },
  { id: "inner_door_left", label: "Inner Door Panel (Left)", position: [0.8, 0.8, 0.2] },
  { id: "inner_door_right", label: "Inner Door Panel (Right)", position: [-0.8, 0.8, 0.2] },
];

// ----------------------------------------------------------------------
// Camera Controller
// ----------------------------------------------------------------------

function CameraSwitcher({ viewMode }: { viewMode: "exterior" | "interior" }) {
  const { camera } = useThree();
  
  React.useEffect(() => {
    if (viewMode === "exterior") {
      camera.position.set(4, 3, 5);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0, 1.2, 0.2);
      camera.lookAt(0, 1.0, 1.5);
    }
  }, [viewMode, camera]);

  return null;
}

// ----------------------------------------------------------------------
// Error Boundary & Fallbacks
// ----------------------------------------------------------------------

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function FallbackCar() {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}><boxGeometry args={[2, 0.6, 4.4]} /><meshStandardMaterial color="#3b82f6" /></mesh>
      <mesh position={[0, 1.1, -0.2]}><boxGeometry args={[1.8, 0.8, 2.4]} /><meshStandardMaterial color="#1e3a8a" wireframe /></mesh>
      <mesh position={[1.1, 0.3, 1.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.4, 0.4, 0.2, 32]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh position={[-1.1, 0.3, 1.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.4, 0.4, 0.2, 32]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh position={[1.1, 0.3, -1.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.4, 0.4, 0.2, 32]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <mesh position={[-1.1, 0.3, -1.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.4, 0.4, 0.2, 32]} /><meshStandardMaterial color="#1f2937" /></mesh>
    </group>
  );
}

function RealCarModel({ debug }: { debug: boolean }) {
  const { scene } = useGLTF("/scene.gltf");
  
  React.useLayoutEffect(() => {
    // 1. Compute bounding box of ONLY visible meshes to avoid invisible nodes inflating the size
    const box = new THREE.Box3();
    scene.traverse((child: any) => {
      if (child.isMesh && child.visible) {
        box.expandByObject(child);
      }
    });
    
    const size = box.getSize(new THREE.Vector3());
    
    // 2. Scale to standard length (assume longest dimension is length)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 4.5; // Standard car length
    const scale = targetSize / maxDim;
    scene.scale.set(scale, scale, scale);
    scene.updateMatrixWorld(true);
    
    // 3. Center the car exactly
    const scaledBox = new THREE.Box3();
    scene.traverse((child: any) => {
      if (child.isMesh && child.visible) {
        scaledBox.expandByObject(child);
      }
    });
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    
    // Move scene so its center X and Z are 0, and bottom Y is 0 (wheels touch the ground)
    scene.position.x -= scaledCenter.x;
    scene.position.z -= scaledCenter.z;
    scene.position.y -= scaledBox.min.y; 
  }, [scene]);

  return (
    <primitive 
      object={scene} 
      onClick={(e: any) => {
        if (debug) {
          e.stopPropagation();
          const { x, y, z } = e.point;
          console.log(`{ id: "new_point", label: "New Point", position: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}] },`);
          alert(`Clicked Point: X:${x.toFixed(2)}, Y:${y.toFixed(2)}, Z:${z.toFixed(2)}`);
        }
      }}
    />
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function CarModel3D({ damagedParts, onChange }: CarModel3DProps) {
  const [viewMode, setViewMode] = useState<"exterior" | "interior">("exterior");
  const [debugMode, setDebugMode] = useState(false);

  const togglePart = (id: string) => {
    if (damagedParts.includes(id)) {
      onChange(damagedParts.filter((p) => p !== id));
    } else {
      onChange([...damagedParts, id]);
    }
  };

  const activeCheckpoints = viewMode === "exterior" ? EXTERIOR_CHECKPOINTS : INTERIOR_CHECKPOINTS;

  return (
    <div style={{ width: "100%", height: 400, background: "#1f2937", borderRadius: 12, overflow: "hidden", position: "relative", border: "1px solid #374151" }}>
      
      {/* UI Controls Overlay */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", gap: 10 }}>
        <button
          onClick={() => setViewMode("exterior")}
          style={{
            padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            background: viewMode === "exterior" ? "#3b82f6" : "rgba(255,255,255,0.1)",
            color: viewMode === "exterior" ? "#fff" : "#9ca3af",
            transition: "all 0.2s"
          }}
        >
          🚘 Exterior
        </button>
        <button
          onClick={() => setViewMode("interior")}
          style={{
            padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            background: viewMode === "interior" ? "#3b82f6" : "rgba(255,255,255,0.1)",
            color: viewMode === "interior" ? "#fff" : "#9ca3af",
            transition: "all 0.2s"
          }}
        >
          💺 Interior
        </button>

        <button
          onClick={() => setDebugMode(!debugMode)}
          style={{
            padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
            background: debugMode ? "#dc2626" : "rgba(255,255,255,0.1)",
            color: debugMode ? "#fff" : "#9ca3af",
            transition: "all 0.2s",
            marginLeft: 20
          }}
        >
          {debugMode ? "Disable Debug" : "Edit Positions"}
        </button>
      </div>

      <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 10, color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>
        {viewMode === "exterior" ? "Drag to Rotate • Scroll to Zoom" : "Inside Cabin View (Drag to look around)"}
      </div>

      {/* 3D Canvas */}
      <Canvas shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <Environment preset="city" />
        
        <CameraSwitcher viewMode={viewMode} />

        <ErrorBoundary fallback={<FallbackCar />}>
          <Suspense fallback={null}>
            <RealCarModel debug={debugMode} />
          </Suspense>
        </ErrorBoundary>

        {/* Hotspots */}
        <OrbitControls makeDefault enableDamping={true} dampingFactor={0.05} />
        {activeCheckpoints.map((cp) => {
          const isDamaged = damagedParts.includes(cp.id);
          return (
            <mesh key={cp.id} position={cp.position as [number, number, number]}>
              <Html distanceFactor={viewMode === "interior" ? 4 : 10} zIndexRange={[100, 0]}>
                <div
                  onClick={() => togglePart(cp.id)}
                  style={{
                    cursor: "pointer",
                    background: isDamaged ? "#dc2626" : "rgba(255,255,255,0.9)",
                    color: isDamaged ? "#fff" : "#1f2937",
                    border: `2px solid ${isDamaged ? "#b91c1c" : "#d1d5db"}`,
                    borderRadius: "50%",
                    width: 18, height: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800,
                    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                    transform: "translate3d(-50%, -50%, 0)",
                    transition: "all 0.2s ease",
                  }}
                  title={cp.label}
                >
                  {isDamaged ? "✕" : ""}
                </div>
                {isDamaged && (
                  <div style={{
                    position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                    marginTop: 4, background: "#dc2626", color: "#fff", padding: "3px 8px",
                    borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                  }}>
                    {cp.label}
                  </div>
                )}
              </Html>
            </mesh>
          );
        })}
      </Canvas>
    </div>
  );
}

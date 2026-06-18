'use client';

import { Canvas, useLoader, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls, Sky, TransformControls, useGLTF, Environment,
  GizmoHelper, GizmoViewport, ContactShadows,
} from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useRef, useEffect, useMemo, useState, Suspense } from 'react';
import * as THREE from 'three';
import type { Obstacle, PanelRect, ShadowResult, Vec3 } from '@/lib/shadowCalc';

export type InstallationType = 'house' | 'park';
export const INSTALLATION_ID = '__installation__';

export type TransformMode = 'translate' | 'rotate';

export interface InstallationState {
  position: Vec3;
  scale: number;       // multiplier sobre el targetHeight base
  rotationY: number;   // rotación en Y (radianes)
}

interface Props {
  obstacles: Obstacle[];
  selectedId: string | null;
  sunDirection: Vec3;
  sunElevDeg: number;
  panel: PanelRect;
  shadowResult: ShadowResult;
  installation: InstallationType;
  installationState: InstallationState;
  transformMode: TransformMode;
  onSelectObstacle: (id: string | null) => void;
  onMoveObstacle: (id: string, x: number, z: number) => void;
  onRotateObstacle: (id: string, yRad: number) => void;
}

const SUN_DISTANCE = 30;

// ──────────────────────────────────────────────────────────────────────────────
// GLBModel — carga, clona y auto-escala al targetHeight especificado.
// Posiciona la base del modelo en y=0.
// ──────────────────────────────────────────────────────────────────────────────
function GLBModel({
  src, targetHeight, position, rotationY = 0, onClick, tintEmissive,
}: {
  src: string;
  targetHeight: number;
  position: Vec3;
  rotationY?: number;
  onClick?: (e: { stopPropagation: () => void }) => void;
  tintEmissive?: string;
}) {
  const { scene } = useGLTF(src);

  // Clonamos para soportar múltiples instancias y procesar materiales/sombras
  const cloned = useMemo(() => {
    const cl = scene.clone(true);
    cl.traverse((node) => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const newMats = mats.map((m) => {
        const std = (m as THREE.MeshStandardMaterial).clone();

        // ── Fix universal: matte non-PBR (no necesita env map) ──
        if ('metalness' in std) std.metalness = 0;
        if ('roughness' in std) std.roughness = 0.85;

        // ── Alpha test agresivo: cualquier material con textura podría tener alpha ──
        // Es seguro para opaques (pixeles con alpha=1 nunca se descartan)
        if (std.map) {
          std.transparent = false;
          std.alphaTest = 0.5;
          std.side = THREE.DoubleSide;
          std.depthWrite = true;
        }

        // ── Bug común en GLBs: color base puro negro ──
        if (std.color && std.color.r === 0 && std.color.g === 0 && std.color.b === 0) {
          // Si el mesh parece foliage (heurística por nombre), asignar verde follaje
          const nameHint = (mesh.name + ' ' + (std.name ?? '')).toLowerCase();
          if (/leaf|leaves|foliage|folla|hoja|copa|tree/.test(nameHint)) {
            std.color.setHex(0x4a7c3a);
          } else {
            std.color.setHex(0xcccccc);
          }
        }

        // ── Tint si está seleccionado ──
        if (tintEmissive && 'emissive' in std) {
          std.emissive = new THREE.Color(tintEmissive);
          std.emissiveIntensity = 0.35;
        }

        std.needsUpdate = true;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
    });
    return cl;
  }, [scene, tintEmissive]);

  // Auto-escala uniforme: usa targetHeight para escalar todo proporcionalmente
  const { scale, yOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = targetHeight / (size.y || 1);
    const bottomY = box.min.y * s;
    return { scale: s, yOffset: -bottomY };
  }, [cloned, targetHeight]);

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, rotationY, 0]}
      onClick={onClick}
    >
      <group position={[0, yOffset, 0]} scale={scale}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

// Preload para que no haya hueco visual la primera vez
useGLTF.preload('/models/arbol-grande.glb');
useGLTF.preload('/models/casa-con-paneles.glb');
useGLTF.preload('/models/parque-de-paneles.glb');
useGLTF.preload('/models/edificio.glb');

// ──────────────────────────────────────────────────────────────────────────────
// Instalación central (casa con paneles o parque de paneles)
// ──────────────────────────────────────────────────────────────────────────────
function Installation({
  type, state, isSelected, onSelect,
}: {
  type: InstallationType;
  state: InstallationState;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const baseHeight = type === 'house' ? 2.5 : 1.0;
  const baseRadius = type === 'house' ? 2.5 : 3;
  const src = type === 'house' ? '/models/casa-con-paneles.glb' : '/models/parque-de-paneles.glb';

  return (
    <group>
      <Suspense fallback={null}>
        <GLBModel
          src={src}
          targetHeight={baseHeight * state.scale}
          position={state.position}
          rotationY={state.rotationY}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          tintEmissive={isSelected ? '#10b981' : undefined}
        />
      </Suspense>
      {isSelected && (
        <mesh
          position={[state.position.x, 0.02, state.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[baseRadius * state.scale * 0.95, baseRadius * state.scale * 1.1, 32]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Obstáculos
// ──────────────────────────────────────────────────────────────────────────────
function ObstacleMesh({ obstacle, isSelected, onSelect }: {
  obstacle: Obstacle; isSelected: boolean; onSelect: () => void;
}) {
  const src = obstacle.type === 'tree' ? '/models/arbol-grande.glb' : '/models/edificio.glb';

  return (
    <group>
      <Suspense fallback={null}>
        <GLBModel
          src={src}
          targetHeight={obstacle.height}
          position={obstacle.position}
          rotationY={obstacle.rotationY ?? 0}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          tintEmissive={isSelected ? '#10b981' : undefined}
        />
      </Suspense>
      {/* Anillo selección en el suelo */}
      {isSelected && (
        <mesh
          position={[obstacle.position.x, 0.02, obstacle.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[obstacle.radius * 0.9, obstacle.radius * 1.15, 32]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ShadowConfig — fuerza la activación del shadow map en el renderer.
// No dependemos de la prop `shadows` del Canvas: lo activamos explícitamente para
// garantizar sombras de contacto entre objetos (árbol → casa, etc.).
// ──────────────────────────────────────────────────────────────────────────────
function ShadowConfig() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.autoUpdate = true;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sun
// ──────────────────────────────────────────────────────────────────────────────
function Sun({ direction, isUp }: { direction: Vec3; isUp: boolean }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  // El sol nunca baja del horizonte para el cálculo de la luz: mantenemos una
  // elevación mínima para que las sombras tengan dirección coherente al atardecer.
  const ly = Math.max(direction.y, 0.06);
  const lx = direction.x;
  const lz = direction.z;
  const len = Math.hypot(lx, ly, lz) || 1;
  const sunPos: [number, number, number] = [
    (lx / len) * SUN_DISTANCE,
    (ly / len) * SUN_DISTANCE,
    (lz / len) * SUN_DISTANCE,
  ];

  // Configura la cámara de sombras una sola vez.
  useEffect(() => {
    const l = lightRef.current;
    if (!l) return;
    // Apunta la luz a un target real añadido a la escena (centro del terreno).
    if (targetRef.current) l.target = targetRef.current;

    l.shadow.mapSize.set(4096, 4096);
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.near = 0.5;
    cam.far = SUN_DISTANCE * 2.5;
    // Frustum ajustado a la escena: cubre los objetos y sus sombras largas al
    // atardecer, manteniendo buena densidad de téxeles (4096 / 70 ≈ 58 px/m).
    cam.left = -35; cam.right = 35; cam.top = 35; cam.bottom = -35;
    cam.updateProjectionMatrix();

    // Bias normal evita el "shadow acne" sin separar la sombra del objeto
    // (peter-panning) → las sombras de contacto quedan pegadas a la base.
    l.shadow.bias = -0.00018;
    l.shadow.normalBias = 0.05;
    l.shadow.radius = 3.5;          // penumbra suave estilo videojuego (PCFSoft)
    l.shadow.blurSamples = 16;
    l.shadow.autoUpdate = true;
  }, []);

  return (
    <>
      {/* target en el centro de la escena */}
      <object3D ref={targetRef} position={[0, 0.5, 0]} />

      <directionalLight
        ref={lightRef}
        position={sunPos}
        intensity={isUp ? 3.4 : 0.05}
        castShadow
        color={isUp ? '#fff3d6' : '#7c8aaa'}
      />

      {/* Luz de relleno tenue: baja para que las sombras tengan contraste real */}
      <ambientLight intensity={isUp ? 0.12 : 0.15} />
      <hemisphereLight color="#cbe7ff" groundColor="#9ab87a" intensity={isUp ? 0.18 : 0.06} />

      {isUp && (
        <mesh position={sunPos}>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshBasicMaterial color="#ffd54f" />
        </mesh>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// URLs fuera del componente para que useLoader las cachee bien
const GRASS_URLS = [
  '/textures/grass/basecolor.jpg',
  '/textures/grass/normal.png',
  '/textures/grass/roughness.jpg',
  '/textures/grass/ao.jpg',
] as const;

function GrassGround() {
  // Suspende mientras cargan las 4 texturas
  const [baseColor, normal, roughness, ao] = useLoader(THREE.TextureLoader, GRASS_URLS as unknown as string[]);

  // Tiling y configuración una sola vez
  useMemo(() => {
    [baseColor, normal, roughness, ao].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(30, 30);
      t.anisotropy = 8;
    });
    baseColor.colorSpace = THREE.SRGBColorSpace;
  }, [baseColor, normal, roughness, ao]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial
        map={baseColor}
        normalMap={normal}
        roughnessMap={roughness}
        aoMap={ao}
        aoMapIntensity={0.8}
        normalScale={new THREE.Vector2(1.2, 1.2)}
      />
    </mesh>
  );
}

/** Fallback plano verde mientras cargan las texturas del césped */
function FallbackGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial color="#7aa85b" />
    </mesh>
  );
}

function Ground() {
  return (
    <Suspense fallback={<FallbackGround />}>
      <GrassGround />
    </Suspense>
  );
}

function Compass() {
  return (
    <mesh position={[0, 0.05, -8]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.6, 0.7, 16]} />
      <meshBasicMaterial color="#ef4444" />
    </mesh>
  );
}

/**
 * Marca sutilmente los puntos sombreados sobre el panel (debug visual).
 * Solo se muestran si hay sombra (>0%), con tamaño chico y opacidad baja
 * para no romper el look realista.
 */
function ShadowDots({ shadowResult }: { shadowResult: ShadowResult }) {
  if (shadowResult.shadowPct === 0) return null;
  return (
    <>
      {shadowResult.shadowedPoints.map((p, i) => (
        <mesh key={`s${i}`} position={[p.x, p.y + 0.03, p.z]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial color="#dc2626" transparent opacity={0.7} />
        </mesh>
      ))}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
/**
 * ObjectHandle estilo Blender — sin feedback loop.
 * El grupo se posiciona/rota UNA SOLA VEZ al montarse o al cambiar de modo.
 * TransformControls modifica directamente group.position/rotation;
 * notificamos el cambio vía onObjectChange.
 *
 * Render con key={selectedId + mode} para forzar remount limpio al cambiar selección o modo.
 */
function ObjectHandle({
  initialPosition, initialRotationY, mode, onMove, onRotate,
}: {
  initialPosition: Vec3;
  initialRotationY: number;
  mode: TransformMode;
  onMove: (x: number, z: number) => void;
  onRotate: (yRad: number) => void;
}) {
  const [group, setGroup] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (group) {
      group.position.set(initialPosition.x, 0, initialPosition.z);
      group.rotation.y = initialRotationY;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  const isTranslate = mode === 'translate';

  return (
    <>
      <group ref={setGroup} />
      {group && (
        <TransformControls
          object={group}
          mode={mode}
          showX={isTranslate}              // rotación: oculto eje X
          showY={!isTranslate}             // rotación: visible solo eje Y
          showZ={isTranslate}              // rotación: oculto eje Z
          size={1.3}
          translationSnap={isTranslate ? 0.25 : null}
          rotationSnap={!isTranslate ? Math.PI / 12 : null}  // snap 15°
          onObjectChange={() => {
            if (isTranslate) {
              onMove(group.position.x, group.position.z);
            } else {
              onRotate(group.rotation.y);
            }
          }}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Controles de cámara estilo Unity / FPS: WASD para mover, Q/E para subir/bajar,
// se desplaza el target del OrbitControls junto con la cámara.
// ──────────────────────────────────────────────────────────────────────────────
function KeyboardCamera({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // No capturar si el usuario está escribiendo en un input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      keys.current.add(e.key.toLowerCase());
    };
    const onUp = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    if (k.size === 0) return;

    const speed = (k.has('shift') ? 18 : 8) * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

    const move = new THREE.Vector3();
    if (k.has('w') || k.has('arrowup'))    move.add(forward);
    if (k.has('s') || k.has('arrowdown'))  move.sub(forward);
    if (k.has('d') || k.has('arrowright')) move.add(right);
    if (k.has('a') || k.has('arrowleft'))  move.sub(right);
    if (k.has('e')) move.y += 1;
    if (k.has('q')) move.y -= 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed);
      camera.position.add(move);
      if (controlsRef.current) {
        controlsRef.current.target.add(move);
        controlsRef.current.update();
      }
    }
  });

  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
export default function Scene({
  obstacles, selectedId, sunDirection, sunElevDeg, panel, shadowResult,
  installation, installationState, transformMode,
  onSelectObstacle, onMoveObstacle, onRotateObstacle,
}: Props) {
  const isDay = sunElevDeg > 0;
  const selectedObstacle = obstacles.find((o) => o.id === selectedId);
  const isInstallationSelected = selectedId === INSTALLATION_ID;
  const orbitRef = useRef<OrbitControlsImpl>(null);

  return (
    <Canvas
      shadows="soft"
      camera={{ position: [14, 11, 16], fov: 50 }}
      onPointerMissed={() => onSelectObstacle(null)}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      style={{ background: isDay ? 'linear-gradient(to bottom, #87ceeb 0%, #b8e0f6 50%, #f0f4f8 100%)' : '#0f172a' }}
    >
      {isDay && (
        <Sky
          sunPosition={[sunDirection.x, sunDirection.y, sunDirection.z]}
          turbidity={6}
          rayleigh={2}
        />
      )}

      {/* HDRI solo para reflejos PBR ambientales (EXR HDR real, intensidad baja) */}
      <Suspense fallback={null}>
        <Environment
          files="/hdri/outdoor-field-day.exr"
          background={false}
          environmentIntensity={0.15}
        />
      </Suspense>

      <ShadowConfig />
      <Sun direction={sunDirection} isUp={isDay} />

      <Ground />

      {/* Sombra de contacto estilo videojuego: ancla los objetos al suelo con un
          oscurecimiento suave bajo su base, complementando la sombra direccional. */}
      {isDay && (
        <ContactShadows
          position={[0, 0.015, 0]}
          scale={70}
          resolution={2048}
          far={14}
          blur={2.2}
          opacity={0.55}
          color="#16271a"
          frames={Infinity}
        />
      )}
      <Compass />
      <Installation
        type={installation}
        state={installationState}
        isSelected={isInstallationSelected}
        onSelect={() => onSelectObstacle(INSTALLATION_ID)}
      />
      <ShadowDots shadowResult={shadowResult} />

      {obstacles.map((o) => (
        <ObstacleMesh
          key={o.id}
          obstacle={o}
          isSelected={o.id === selectedId}
          onSelect={() => onSelectObstacle(o.id)}
        />
      ))}

      {selectedObstacle && (
        <ObjectHandle
          key={`${selectedObstacle.id}-${transformMode}`}
          initialPosition={selectedObstacle.position}
          initialRotationY={selectedObstacle.rotationY ?? 0}
          mode={transformMode}
          onMove={(x, z) => onMoveObstacle(selectedObstacle.id, x, z)}
          onRotate={(yRad) => onRotateObstacle(selectedObstacle.id, yRad)}
        />
      )}
      {isInstallationSelected && (
        <ObjectHandle
          key={`${INSTALLATION_ID}-${transformMode}`}
          initialPosition={installationState.position}
          initialRotationY={installationState.rotationY}
          mode={transformMode}
          onMove={(x, z) => onMoveObstacle(INSTALLATION_ID, x, z)}
          onRotate={(yRad) => onRotateObstacle(INSTALLATION_ID, yRad)}
        />
      )}

      {/* Post-processing: ambient occlusion suave (no enmascara sombras) */}
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <N8AO
          aoRadius={1.0}
          intensity={1.5}
          distanceFalloff={0.4}
          color="#000000"
          quality="medium"
        />
      </EffectComposer>

      <OrbitControls
        ref={orbitRef}
        target={[0, 2, 0]}
        minDistance={3}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.1}
        makeDefault
      />

      {/* Controles WASD/QE estilo Unity */}
      <KeyboardCamera controlsRef={orbitRef} />

      {/* Gizmo de orientación en esquina superior derecha */}
      <GizmoHelper alignment="top-right" margin={[80, 80]}>
        <GizmoViewport
          axisColors={['#ef4444', '#22c55e', '#3b82f6']}
          labelColor="white"
        />
      </GizmoHelper>
    </Canvas>
  );
}

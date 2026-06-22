'use client';

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 *  PanelPreview — visor 3D del panel solar (solar-panel.glb) estilo Unreal Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 * Visor fijo a la derecha (como el preview de Android Studio / Xcode). El panel NO
 * se mueve: la cámara solo orbita. Hay UNA sola fuente de luz (el Sol) que ilumina
 * el panel; según la hora su ángulo cambia. Entre el Sol y el panel hay un obstáculo
 * que proyecta una SOMBRA REAL sobre el panel — su tamaño crece con el % del slider
 * activo, así que ves en tiempo real cuánta sombra tendría esa franja.
 *
 * Claves técnicas:
 *  - El GLB es un import FBX de Sketchfab: panel inclinado ~45°, material 100%
 *    metálico → sin entorno se ve NEGRO. Por eso bajamos metalness y añadimos un
 *    Environment (reflejos) para que el panel se vea iluminado y realista.
 *  - El modelo se normaliza (centra/escala) y la cámara es FIJA, para que no
 *    parpadee ni desaparezca al recolocarse.
 *  - Sombras suaves nativas (PCFSoftShadowMap + shadow.radius). NO usamos el
 *    <SoftShadows> de drei: su shader PCSS no compila en three 0.184 y dejaba el
 *    panel sin renderizar (unpackRGBAToDepth: no matching overloaded function).
 */

import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, useGLTF, Environment, ContactShadows,
} from '@react-three/drei';
import { Component, useEffect, useMemo, useRef, Suspense, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/lib/shadowCalc';

const MODEL_SRC = '/models/solar-panel.glb';
useGLTF.preload(MODEL_SRC);

const TARGET_SIZE = 3.4;       // ancho objetivo del panel en unidades de mundo
const SUN_DISTANCE = 16;
const PANEL_CENTER_Y = 0.95;   // centro aprox. del panel ya normalizado (base en y=0)

// Aísla cualquier fallo (p. ej. carga del Environment) para que NUNCA borre la
// escena entera: si algo dentro falla, se renderiza sin ese hijo.
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

// ──────────────────────────────────────────────────────────────────────────────
// Una sola luz direccional = el Sol. Su ángulo viene de la hora activa y emite la
// sombra real (panel sobre el suelo + obstáculo sobre el panel).
// ──────────────────────────────────────────────────────────────────────────────
function Sun({ direction, isUp }: { direction: Vec3; isUp: boolean }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  const ly = Math.max(direction.y, 0.1);
  const len = Math.hypot(direction.x, ly, direction.z) || 1;
  const sunPos: [number, number, number] = [
    (direction.x / len) * SUN_DISTANCE,
    (ly / len) * SUN_DISTANCE,
    (direction.z / len) * SUN_DISTANCE,
  ];

  useEffect(() => {
    const l = lightRef.current;
    if (!l) return;
    if (targetRef.current) l.target = targetRef.current;
    l.shadow.mapSize.set(2048, 2048);
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.near = 0.5;
    cam.far = SUN_DISTANCE * 2.6;
    cam.left = -6.5; cam.right = 6.5; cam.top = 6.5; cam.bottom = -6.5;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.00018;
    l.shadow.normalBias = 0.035;
    // Penumbra suave nativa (PCFSoftShadowMap) — sustituye a <SoftShadows> (PCSS),
    // cuyo shader no compila en three 0.184 (unpackRGBAToDepth → el panel no se veía).
    l.shadow.radius = 4;
    l.shadow.blurSamples = 16;
  }, []);

  return (
    <>
      <object3D ref={targetRef} position={[0, 0.9, 0]} />
      <directionalLight
        ref={lightRef}
        position={sunPos}
        intensity={isUp ? 3.6 : 0.05}
        castShadow
        color={isUp ? '#fff4da' : '#7c8aaa'}
      />
      {/* Relleno BAJO a propósito: así, cuando el obstáculo bloquea el sol, el panel
          se oscurece de verdad (contraste realista tipo Unity/UE). Suficiente para
          que la sombra no sea negro puro (hay luz de cielo), pero no la lava. */}
      <ambientLight intensity={isUp ? 0.12 : 0.14} />
      <hemisphereLight color="#cfe8ff" groundColor="#b8c2cc" intensity={isUp ? 0.18 : 0.08} />
      {isUp && (
        <mesh position={sunPos}>
          <sphereGeometry args={[0.6, 20, 20]} />
          <meshBasicMaterial color="#ffd54f" toneMapped={false} />
        </mesh>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Obstáculo que proyecta la sombra sobre el panel. Es un plano GRANDE, perpendicular
// al Sol e INVISIBLE para la cámara (colorWrite=false) pero que SÍ proyecta sombra.
// No intentamos adivinar dónde está la cara del panel: el plano barre una banda de
// sombra que baja por TODA la silueta a medida que crece `coverage`, así que la
// sombra cae sobre la cara esté donde esté. A coverage=1 cubre el panel entero.
//   - El Sol es luz direccional (rayos paralelos) → la silueta del plano se proyecta
//     fielmente sobre el panel.
//   - colorWrite=false + depthWrite=false → no se ve el plano, solo su SOMBRA.
// ──────────────────────────────────────────────────────────────────────────────
function ShadowCaster({
  panelCenter, panelHalf, sunDir, coverage,
}: {
  panelCenter: THREE.Vector3; panelHalf: THREE.Vector3; sunDir: Vec3; coverage: number;
}) {
  const { position, quaternion, width, height } = useMemo(() => {
    const dir = new THREE.Vector3(sunDir.x, Math.max(sunDir.y, 0.12), sunDir.z).normalize();

    // Base ortonormal: dir (hacia el Sol) + dos ejes en el plano perpendicular.
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y);
    if (up.lengthSq() < 1e-4) {
      const z = new THREE.Vector3(0, 0, 1);
      up.copy(z).addScaledVector(dir, -z.dot(dir));
    }
    up.normalize();
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const up2 = new THREE.Vector3().crossVectors(dir, right).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up2, dir),
    );

    // Semiextensión REAL del panel proyectada sobre cada eje (no la esfera): para una
    // AABB, h·|eje|. Así el barrido se mapea al alto/ancho verdaderos del panel.
    const hUp    = panelHalf.x * Math.abs(up2.x)   + panelHalf.y * Math.abs(up2.y)   + panelHalf.z * Math.abs(up2.z);
    const hRight = panelHalf.x * Math.abs(right.x) + panelHalf.y * Math.abs(right.y) + panelHalf.z * Math.abs(right.z);

    // Línea de sombra: baja linealmente de +hUp (coverage 0 → nada) a −hUp (coverage 1
    // → todo). La fracción sombreada del panel resulta EXACTAMENTE = coverage.
    const sweepLine = hUp * (1 - 2 * coverage);
    const Hh = hUp + panelHalf.length();              // semialto del plano (cubre por encima)
    const centerUp2 = sweepLine + Hh;                 // borde inferior del plano = sweepLine
    const pos = panelCenter.clone()
      .addScaledVector(dir, panelHalf.length() * 1.5) // delante del panel, hacia el Sol
      .addScaledVector(up2, centerUp2);

    return {
      position: [pos.x, pos.y, pos.z] as [number, number, number],
      quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      width: 2 * hRight + 0.6,                          // cubre todo el ancho + margen
      height: 2 * Hh,
    };
  }, [panelCenter, panelHalf, sunDir, coverage]);

  if (coverage <= 0) return null;

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <planeGeometry args={[width, height]} />
      {/* Invisible para la cámara, pero proyecta sombra (la pasada de sombra usa su
          propio material de profundidad, ajeno a colorWrite). */}
      <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// El panel solar: carga, arregla materiales (quita el metalness=1 que lo dejaba
// negro), centra en XZ, apoya la base en y=0 y autoescala. Devuelve también sus
// métricas (centro/extensión) para anclar el obstáculo y su sombra.
// ──────────────────────────────────────────────────────────────────────────────
function PanelWithShadow({ sunDir, coverage }: { sunDir: Vec3; coverage: number }) {
  const { scene } = useGLTF(MODEL_SRC);

  const { object, center, half } = useMemo(() => {
    const cl = scene.clone(true);
    cl.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const fixed = mats.map((m) => {
        const std = (m as THREE.MeshStandardMaterial).clone();
        // ── Fix clave: el material venía 100% metálico → negro sin env map ──
        std.metalness = 0.25;
        std.roughness = THREE.MathUtils.clamp(std.roughness ?? 0.5, 0.35, 0.75);
        std.envMapIntensity = 1.1;
        if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
        std.needsUpdate = true;
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? fixed : fixed[0];
    });

    // Normalizar: centrar XZ, base en y=0, escalar al ancho objetivo.
    const box0 = new THREE.Box3().setFromObject(cl);
    const size0 = new THREE.Vector3(); box0.getSize(size0);
    const center0 = new THREE.Vector3(); box0.getCenter(center0);
    const scale = TARGET_SIZE / Math.max(size0.x, size0.z, 0.001);
    cl.scale.setScalar(scale);
    cl.position.set(-center0.x * scale, -box0.min.y * scale, -center0.z * scale);
    cl.updateMatrixWorld(true);

    // Métricas finales en mundo
    const box1 = new THREE.Box3().setFromObject(cl);
    const size1 = new THREE.Vector3(); box1.getSize(size1);
    const c1 = new THREE.Vector3(); box1.getCenter(c1);
    return {
      object: cl,
      center: c1,
      half: size1.clone().multiplyScalar(0.5),   // semiextensión real (AABB) del panel
    };
  }, [scene]);

  return (
    <group>
      {/* dispose={null}: el clone comparte geometrías con el GLTF cacheado; sin esto,
          el auto-dispose de r3f (StrictMode: monta→desmonta→monta) las libera y el
          modelo aparece un instante y desaparece. */}
      <primitive object={object} dispose={null} />
      <ShadowCaster
        panelCenter={center}
        panelHalf={half}
        sunDir={sunDir}
        coverage={coverage}
      />
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#e7ecf2" roughness={1} metalness={0} />
    </mesh>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
interface Props {
  sunDirection: Vec3;
  sunElevDeg: number;
  shadowPct: number;
}

export default function PanelPreview({ sunDirection, sunElevDeg, shadowPct }: Props) {
  const isDay = sunElevDeg > 0;
  const coverage = THREE.MathUtils.clamp(shadowPct / 100, 0, 1);

  return (
    <Canvas
      shadows="soft"
      camera={{ position: [4.8, 3.6, 5.8], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{
        background: isDay
          ? 'linear-gradient(to bottom, #cfe6f6 0%, #e2eef8 55%, #f5fafd 100%)'
          : 'linear-gradient(to bottom, #1e293b 0%, #0b1220 100%)',
      }}
    >
      {/* Environment: reflejos PBR para que el panel (metálico) se vea iluminado.
          Aislado en ErrorBoundary → si la carga falla, la escena sigue viéndose. */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Environment
            files="/hdri/outdoor-field-day.jpg"
            background={false}
            environmentIntensity={isDay ? 0.32 : 0.12}
          />
        </Suspense>
      </ErrorBoundary>

      <Sun direction={sunDirection} isUp={isDay} />
      <GroundPlane />

      {/* Sombra de contacto suave bajo el panel (anclaje al suelo, look producto) */}
      {isDay && (
        <ContactShadows
          position={[0, 0.01, 0]}
          scale={10}
          resolution={1024}
          far={6}
          blur={2.4}
          opacity={0.5}
          color="#1b2430"
        />
      )}

      {/* El panel + su obstáculo/sombra. Cámara fija (sin autoencuadre dinámico)
          para que el modelo no parpadee ni desaparezca al recolocar la cámara. */}
      <Suspense fallback={null}>
        <PanelWithShadow sunDir={sunDirection} coverage={coverage} />
      </Suspense>

      <OrbitControls
        enablePan={false}
        target={[0, PANEL_CENTER_Y, 0]}
        minDistance={3}
        maxDistance={16}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.1}
        makeDefault
      />
    </Canvas>
  );
}

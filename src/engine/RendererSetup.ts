import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LIGHTING_CONFIG } from '../render/lightingConfig';

export interface RendererContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  isSoftwareGl: boolean;
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createRendererContext(
  container: HTMLElement,
  fov: number,
  renderDistance: number,
): RendererContext {
  const isSoftwareGl = detectSoftwareWebGL();
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHTING_CONFIG.renderer.toneMappingExposure;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  const w = Math.max(1, container.clientWidth || window.innerWidth || 1280);
  const h = Math.max(1, container.clientHeight || window.innerHeight || 720);
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LIGHTING_CONFIG.renderer.skyDayHex);
  scene.fog = new THREE.Fog(LIGHTING_CONFIG.renderer.skyDayHex, 24, renderDistance * 16 + 10);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    scene.environmentIntensity = LIGHTING_CONFIG.renderer.environmentIntensity;
    roomEnv.dispose();
    pmrem.dispose();
  } catch {
    scene.environment = null;
  }

  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 240);
  scene.add(camera);

  return { renderer, scene, camera, isSoftwareGl };
}

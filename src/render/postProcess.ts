import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LIGHTING_CONFIG } from './lightingConfig';

export class PostProcessor {
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private isSoftwareGl: boolean;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    isSoftwareGl: boolean,
    width: number,
    height: number,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isSoftwareGl = isSoftwareGl;

    // Only enable EffectComposer + Bloom on real GPU WebGL (skip on Software WebGL for crisp speed)
    if (!isSoftwareGl) {
      try {
        const safeW = Math.max(1, width);
        const safeH = Math.max(1, height);
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        const { strength, radius, threshold } = LIGHTING_CONFIG.bloom;
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(safeW, safeH), strength, radius, threshold);
        const outputPass = new OutputPass();
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
        composer.addPass(outputPass);
        this.composer = composer;
        this.bloomPass = bloomPass;
      } catch {
        this.composer = null;
        this.bloomPass = null;
      }
    }
  }

  public setSize(width: number, height: number): void {
    if (this.composer && !this.isSoftwareGl) {
      const safeW = Math.max(1, width);
      const safeH = Math.max(1, height);
      this.composer.setSize(safeW, safeH);
      this.bloomPass?.setSize(safeW, safeH);
    }
  }

  public render(): void {
    if (this.composer && !this.isSoftwareGl) {
      try {
        this.composer.render();
        return;
      } catch {
        this.composer.dispose();
        this.composer = null;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.bloomPass?.dispose();
    this.composer?.dispose();
  }
}

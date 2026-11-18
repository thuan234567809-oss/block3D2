import * as THREE from 'three';

const MAX_PARTICLES = 180;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

export class EffectsPool {
  private particles: Particle[];
  private cursor = 0;
  public instancedMesh: THREE.InstancedMesh;
  public highlightBox: THREE.LineSegments;
  public crackMesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      size: 0.12,
      colorHex: 0xffffff,
    }));

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.instancedMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      _dummy.position.set(0, -999, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);
      this.instancedMesh.setColorAt(i, _color.setHex(0xffffff));
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    scene.add(this.instancedMesh);

    // Voxel target highlight wireframe
    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.highlightBox = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75 }),
    );
    this.highlightBox.visible = false;
    scene.add(this.highlightBox);

    // Mining crack overlay box
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.crackMesh.visible = false;
    scene.add(this.crackMesh);
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count = 12,
    speed = 3.2,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.5;
      p.y = y + (Math.random() - 0.5) * 0.5;
      p.z = z + (Math.random() - 0.5) * 0.5;
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = 1.5 + Math.random() * speed * 0.9;
      p.vz = (Math.random() - 0.5) * speed;
      p.maxLife = 0.35 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.size = 0.08 + Math.random() * 0.1;
      p.colorHex = colorHex;
      this.instancedMesh.setColorAt(this.cursor === 0 ? MAX_PARTICLES - 1 : this.cursor - 1, _color.setHex(colorHex));
    }
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = p.size * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anyActive) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public setTargetHighlight(
    bx: number,
    by: number,
    bz: number,
    visible: boolean,
    crackProgress: number,
    bounds?: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null,
  ): void {
    this.highlightBox.visible = visible;
    this.crackMesh.visible = visible && crackProgress > 0.02;
    if (visible) {
      const b = bounds ?? { minX: bx, minY: by, minZ: bz, maxX: bx + 1, maxY: by + 1, maxZ: bz + 1 };
      const sx = Math.max(0.05, b.maxX - b.minX);
      const sy = Math.max(0.05, b.maxY - b.minY);
      const sz = Math.max(0.05, b.maxZ - b.minZ);
      const cx = (b.minX + b.maxX) * 0.5;
      const cy = (b.minY + b.maxY) * 0.5;
      const cz = (b.minZ + b.maxZ) * 0.5;
      this.highlightBox.position.set(cx, cy, cz);
      this.highlightBox.scale.set(sx, sy, sz);
      this.crackMesh.position.set(cx, cy, cz);
      this.crackMesh.scale.set(sx, sy, sz);
      (this.crackMesh.material as THREE.MeshBasicMaterial).opacity = crackProgress * 0.55;
    }
  }

  public dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
    this.highlightBox.geometry.dispose();
    (this.highlightBox.material as THREE.Material).dispose();
    this.crackMesh.geometry.dispose();
    (this.crackMesh.material as THREE.Material).dispose();
  }
}

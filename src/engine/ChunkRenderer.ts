import * as THREE from 'three';
import { LIGHTING_CONFIG } from '../render/lightingConfig';
import { createBlockAtlasTextures } from '../render/textures';
import { AnimatedWaterMaterial, createWaterMaterial } from '../render/waterMaterial';
import { CHUNK_SIZE, chunkKey } from '../world/chunkData';
import { buildChunkMesh, MeshBuffers } from '../world/mesher';
import { WorldManager } from '../world/worldManager';

interface ChunkMeshEntry {
  opaqueMesh: THREE.Mesh;
  translucentMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
}

export class ChunkRenderer {
  private group = new THREE.Group();
  private entries = new Map<string, ChunkMeshEntry>();
  private atlasTex: THREE.CanvasTexture;
  private bumpTex: THREE.CanvasTexture;
  private opaqueMat: THREE.MeshStandardMaterial;
  private translucentMat: THREE.MeshStandardMaterial;
  private waterMatCtrl: AnimatedWaterMaterial;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const { colorMap, bumpMap } = createBlockAtlasTextures(renderer);
    this.atlasTex = colorMap;
    this.bumpTex = bumpMap;
    const { opaqueBlock, translucentBlock } = LIGHTING_CONFIG.materials;

    this.opaqueMat = new THREE.MeshStandardMaterial({
      map: this.atlasTex,
      bumpMap: this.bumpTex,
      bumpScale: opaqueBlock.bumpScale,
      vertexColors: true,
      roughness: opaqueBlock.roughness,
      metalness: opaqueBlock.metalness,
      envMapIntensity: opaqueBlock.envMapIntensity,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.translucentMat = new THREE.MeshStandardMaterial({
      map: this.atlasTex,
      vertexColors: true,
      roughness: translucentBlock.roughness,
      metalness: translucentBlock.metalness,
      envMapIntensity: translucentBlock.envMapIntensity,
      transparent: true,
      opacity: translucentBlock.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waterMatCtrl = createWaterMaterial(this.atlasTex);
    scene.add(this.group);
  }

  public updateWater(elapsedSec: number): void {
    this.waterMatCtrl.update(elapsedSec);
  }

  private toGeometry(buf: MeshBuffers): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buf.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(buf.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(buf.uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(buf.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(buf.indices, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  public updateChunks(
    world: WorldManager,
    playerCx: number,
    playerCz: number,
    renderDistance: number,
    maxRebuildsPerFrame = 3,
  ): void {
    const desired = new Set<string>();
    const toBuild: { cx: number; cz: number; dist: number }[] = [];

    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      for (let dx = -renderDistance; dx <= renderDistance; dx++) {
        if (dx * dx + dz * dz > renderDistance * renderDistance + 1) continue;
        const cx = playerCx + dx;
        const cz = playerCz + dz;
        const key = chunkKey(cx, cz);
        desired.add(key);
        const chunk = world.getOrCreateChunk(cx, cz);
        if (chunk.dirty || !this.entries.has(key)) {
          toBuild.push({ cx, cz, dist: dx * dx + dz * dz });
        }
      }
    }

    for (const [key, entry] of this.entries.entries()) {
      if (!desired.has(key)) {
        this.group.remove(entry.opaqueMesh, entry.translucentMesh, entry.waterMesh);
        entry.opaqueMesh.geometry.dispose();
        entry.translucentMesh.geometry.dispose();
        entry.waterMesh.geometry.dispose();
        this.entries.delete(key);
      }
    }

    toBuild.sort((a, b) => a.dist - b.dist);
    const limit = Math.min(maxRebuildsPerFrame, toBuild.length);
    for (let i = 0; i < limit; i++) {
      const { cx, cz } = toBuild[i];
      const key = chunkKey(cx, cz);
      const chunk = world.getOrCreateChunk(cx, cz);
      const built = buildChunkMesh(cx, cz, world.getBlock, world.getBlockMeta);

      const old = this.entries.get(key);
      if (old) {
        old.opaqueMesh.geometry.dispose();
        old.translucentMesh.geometry.dispose();
        old.waterMesh.geometry.dispose();
        old.opaqueMesh.geometry = this.toGeometry(built.opaque);
        old.translucentMesh.geometry = this.toGeometry(built.translucent);
        old.waterMesh.geometry = this.toGeometry(built.water);
      } else {
        const opaqueMesh = new THREE.Mesh(this.toGeometry(built.opaque), this.opaqueMat);
        opaqueMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
        opaqueMesh.castShadow = true;
        opaqueMesh.receiveShadow = true;
        opaqueMesh.frustumCulled = true;

        const translucentMesh = new THREE.Mesh(this.toGeometry(built.translucent), this.translucentMat);
        translucentMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
        translucentMesh.receiveShadow = true;
        translucentMesh.renderOrder = 2;
        translucentMesh.frustumCulled = true;

        const waterMesh = new THREE.Mesh(this.toGeometry(built.water), this.waterMatCtrl.material);
        waterMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
        waterMesh.receiveShadow = true;
        waterMesh.renderOrder = 3;
        waterMesh.frustumCulled = true;

        this.group.add(opaqueMesh, translucentMesh, waterMesh);
        this.entries.set(key, { opaqueMesh, translucentMesh, waterMesh });
      }
      chunk.dirty = false;
    }
  }

  public prebuildAllVisible(world: WorldManager, playerCx: number, playerCz: number, renderDistance: number): void {
    this.updateChunks(world, playerCx, playerCz, renderDistance, 100);
  }

  public dispose(): void {
    for (const entry of this.entries.values()) {
      this.group.remove(entry.opaqueMesh, entry.translucentMesh, entry.waterMesh);
      entry.opaqueMesh.geometry.dispose();
      entry.translucentMesh.geometry.dispose();
      entry.waterMesh.geometry.dispose();
    }
    this.entries.clear();
    this.opaqueMat.dispose();
    this.translucentMat.dispose();
    this.waterMatCtrl.material.dispose();
    this.atlasTex.dispose();
    this.bumpTex.dispose();
  }
}

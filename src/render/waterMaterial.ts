import * as THREE from 'three';
import { LIGHTING_CONFIG } from './lightingConfig';

export interface AnimatedWaterMaterial {
  material: THREE.MeshStandardMaterial;
  update: (elapsedSec: number) => void;
}

export function createWaterMaterial(atlasMap: THREE.Texture): AnimatedWaterMaterial {
  const uniforms = {
    uTime: { value: 0 },
  };
  const waterCfg = LIGHTING_CONFIG.materials.water;
  const [er, eg, eb] = waterCfg.rippleRgb;

  const material = new THREE.MeshStandardMaterial({
    map: atlasMap,
    vertexColors: true,
    roughness: waterCfg.roughness,
    metalness: waterCfg.metalness,
    envMapIntensity: waterCfg.envMapIntensity,
    transparent: true,
    opacity: waterCfg.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\nvarying vec3 vWorldWavePos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        if (normal.y > 0.5) {
          float wave = sin(wp.x * 1.45 + uTime * 2.1) * 0.032 + cos(wp.z * 1.65 + uTime * 1.75) * 0.028;
          transformed.y += wave;
        }
        vWorldWavePos = wp.xyz;`,
      );
    shader.fragmentShader =
      `uniform float uTime;\nvarying vec3 vWorldWavePos;\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float ripple = sin(vWorldWavePos.x * 3.1 + uTime * 2.6) * cos(vWorldWavePos.z * 2.9 - uTime * 2.1);
        totalEmissiveRadiance += vec3(${er}, ${eg}, ${eb}) * max(0.0, ripple);`,
      );
  };
  material.customProgramCacheKey = () => 'blockworld-water-v4';

  return {
    material,
    update: (elapsedSec: number) => {
      uniforms.uTime.value = elapsedSec;
    },
  };
}

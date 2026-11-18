/**
 * Calibrated lighting, exposure, and material reflection parameters for BlockWorld Survival.
 * Keeps matte voxel blocks crisp without washed-out glare while preserving distinct
 * metallic highlights on forged tools/ingots and clear subtle reflections on glass and water.
 */
export const LIGHTING_CONFIG = {
  renderer: {
    toneMappingExposure: 0.9,
    environmentIntensity: 0.26,
    skyDayHex: '#72ace8',
    skySunsetHex: '#e08458',
    skyNightHex: '#0b1222',
    stormTintHex: '#435163',
  },
  sun: {
    dayBaseIntensity: 0.24,
    dayAddedIntensity: 0.78, // peak midday ~1.02 (rebalanced down from 1.50)
    nightMoonIntensity: 0.24,
    stormMultiplier: 0.58,
    lightningBoost: 1.1,
  },
  hemi: {
    dayAddedIntensity: 0.28,
    baseIntensity: 0.22, // peak midday ~0.50 (rebalanced down from 0.84)
    skyDayHex: '#93c1f5',
    skyNightHex: '#1b2844',
    groundDayHex: '#4a3f33',
    groundNightHex: '#151820',
  },
  materials: {
    opaqueBlock: {
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.12,
      bumpScale: 0.02,
    },
    translucentBlock: {
      roughness: 0.2,
      metalness: 0.05,
      envMapIntensity: 0.38,
      opacity: 0.7,
    },
    water: {
      roughness: 0.24,
      metalness: 0.06,
      envMapIntensity: 0.36,
      opacity: 0.74,
      rippleRgb: [0.012, 0.03, 0.052] as const,
    },
    mobEnvIntensity: 0.22,
    nonMetalItemEnvIntensity: 0.25,
    metalItemEnvIntensity: 0.72,
  },
  bloom: {
    strength: 0.07,
    radius: 0.18,
    threshold: 0.96,
  },
} as const;

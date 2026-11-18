import * as THREE from 'three';
import { WeatherType } from '../types/game';
import { LIGHTING_CONFIG } from './lightingConfig';

const WEATHER_COUNT = 600;
const CLOUD_COUNT = 26;
const _dummy = new THREE.Object3D();
const _dayColor = new THREE.Color(LIGHTING_CONFIG.renderer.skyDayHex);
const _sunsetColor = new THREE.Color(LIGHTING_CONFIG.renderer.skySunsetHex);
const _nightColor = new THREE.Color(LIGHTING_CONFIG.renderer.skyNightHex);
const _stormTint = new THREE.Color(LIGHTING_CONFIG.renderer.stormTintHex);
const _skyCur = new THREE.Color();
const _sunColDay = new THREE.Color('#fff2d6');
const _sunColSet = new THREE.Color('#f58a48');
const _moonCol = new THREE.Color('#86abd9');
const _hemiSkyDay = new THREE.Color(LIGHTING_CONFIG.hemi.skyDayHex);
const _hemiSkyNight = new THREE.Color(LIGHTING_CONFIG.hemi.skyNightHex);
const _hemiGroundDay = new THREE.Color(LIGHTING_CONFIG.hemi.groundDayHex);
const _hemiGroundNight = new THREE.Color(LIGHTING_CONFIG.hemi.groundNightHex);

export class SkyWeatherSystem {
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public sunMesh: THREE.Mesh;
  public moonMesh: THREE.Mesh;
  public stars: THREE.Points;
  public cloudMesh: THREE.InstancedMesh;
  public weatherMesh: THREE.InstancedMesh;
  private cloudCoords: { x: number; z: number; sx: number; sz: number; yOff: number }[] = [];
  private weatherPositions: Float32Array;
  private weatherSpeeds: Float32Array;
  private lightningFlash = 0;
  private lightningCooldown = 6;
  private cloudDrift = 0;
  private isSoftwareGl: boolean;

  constructor(scene: THREE.Scene, isSoftwareGl: boolean) {
    this.isSoftwareGl = isSoftwareGl;

    this.sunLight = new THREE.DirectionalLight(0xfff2d6, 0.96);
    if (!isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      const d = 34;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.camera.near = 1;
      this.sunLight.shadow.camera.far = 145;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(
      LIGHTING_CONFIG.hemi.skyDayHex,
      LIGHTING_CONFIG.hemi.groundDayHex,
      0.46,
    );
    scene.add(this.hemiLight);

    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe484, fog: false }),
    );
    scene.add(this.sunMesh);

    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xdbe9ff, fog: false }),
    );
    scene.add(this.moonMesh);

    // Drifting blocky voxel cloud layer
    const cloudGeo = new THREE.BoxGeometry(1, 2.2, 1);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xf5f9ff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_COUNT);
    this.cloudMesh.frustumCulled = false;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      this.cloudCoords.push({
        x: (Math.random() - 0.5) * 160,
        z: (Math.random() - 0.5) * 160,
        sx: 8 + Math.floor(Math.random() * 14),
        sz: 6 + Math.floor(Math.random() * 10),
        yOff: (i % 3) * 1.4,
      });
    }
    scene.add(this.cloudMesh);

    const starCount = 350;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.15 + Math.random() * 0.85);
      const r = 130;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0, fog: false });
    this.stars = new THREE.Points(starGeo, starMat);
    scene.add(this.stars);

    const dropGeo = new THREE.BoxGeometry(0.05, 0.55, 0.05);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x99ccff, transparent: true, opacity: 0.65 });
    this.weatherMesh = new THREE.InstancedMesh(dropGeo, dropMat, WEATHER_COUNT);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.visible = false;
    this.weatherPositions = new Float32Array(WEATHER_COUNT * 3);
    this.weatherSpeeds = new Float32Array(WEATHER_COUNT);
    for (let i = 0; i < WEATHER_COUNT; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 34;
      this.weatherPositions[i * 3 + 1] = Math.random() * 24;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 34;
      this.weatherSpeeds[i] = 0.8 + Math.random() * 0.4;
    }
    scene.add(this.weatherMesh);
  }

  public update(
    scene: THREE.Scene,
    playerPos: THREE.Vector3,
    timeOfDay: number,
    weather: WeatherType,
    dt: number,
    onLightning?: () => void,
  ): void {
    const sunAngle = timeOfDay * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const dist = 110;

    this.sunMesh.position.set(playerPos.x + sunX * dist, playerPos.y + sunY * dist, playerPos.z - 25);
    this.moonMesh.position.set(playerPos.x - sunX * dist, playerPos.y - sunY * dist, playerPos.z + 25);
    this.stars.position.copy(playerPos);

    const daylight = THREE.MathUtils.clamp(sunY * 2.2 + 0.2, 0, 1);
    const sunsetFactor = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 4.0, 0, 1);

    const lightDirY = sunY >= -0.05 ? sunY : -sunY;
    const lightDirX = sunY >= -0.05 ? sunX : -sunX;
    this.sunLight.position.set(playerPos.x + lightDirX * 55, playerPos.y + Math.max(12, lightDirY * 55), playerPos.z + 18);
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    _skyCur.copy(_nightColor).lerp(_dayColor, daylight);
    if (sunsetFactor > 0.01) _skyCur.lerp(_sunsetColor, sunsetFactor * 0.65);
    if (weather === WeatherType.Rain || weather === WeatherType.Storm) {
      _skyCur.lerp(_stormTint, weather === WeatherType.Storm ? 0.62 : 0.35);
    }

    if (weather === WeatherType.Storm) {
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0) {
        this.lightningFlash = 1.0;
        this.lightningCooldown = 5 + Math.random() * 9;
        onLightning?.();
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 5);
      _skyCur.lerp(new THREE.Color('#eef6ff'), this.lightningFlash * 0.7);
    }

    if (scene.background instanceof THREE.Color) scene.background.copy(_skyCur);
    else scene.background = _skyCur.clone();
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(_skyCur);

    if (sunY >= -0.05) {
      this.sunLight.color.copy(_sunColDay).lerp(_sunColSet, sunsetFactor * 0.8);
      const dayIntensity = LIGHTING_CONFIG.sun.dayBaseIntensity + daylight * LIGHTING_CONFIG.sun.dayAddedIntensity;
      this.sunLight.intensity =
        dayIntensity * (weather === WeatherType.Storm ? LIGHTING_CONFIG.sun.stormMultiplier : 1) +
        this.lightningFlash * LIGHTING_CONFIG.sun.lightningBoost;
    } else {
      this.sunLight.color.copy(_moonCol);
      this.sunLight.intensity = LIGHTING_CONFIG.sun.nightMoonIntensity + this.lightningFlash * LIGHTING_CONFIG.sun.lightningBoost;
    }

    this.hemiLight.color.copy(_hemiSkyNight).lerp(_hemiSkyDay, daylight);
    this.hemiLight.groundColor.copy(_hemiGroundNight).lerp(_hemiGroundDay, daylight);
    this.hemiLight.intensity = LIGHTING_CONFIG.hemi.baseIntensity + daylight * LIGHTING_CONFIG.hemi.dayAddedIntensity;
    (this.stars.material as THREE.PointsMaterial).opacity = THREE.MathUtils.clamp((1 - daylight) * 0.9, 0, 0.9);

    // Update drifting voxel clouds
    this.cloudDrift += dt * 1.4;
    const cloudMat = this.cloudMesh.material as THREE.MeshBasicMaterial;
    cloudMat.color.setHex(weather === WeatherType.Storm ? 0x677487 : sunsetFactor > 0.25 ? 0xf2c9b6 : 0xe9f0fa);
    cloudMat.opacity = 0.28 + daylight * 0.42;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const c = this.cloudCoords[i];
      const relX = ((((c.x + this.cloudDrift - playerPos.x) % 160) + 240) % 160) - 80;
      const relZ = ((((c.z - playerPos.z) % 160) + 240) % 160) - 80;
      _dummy.position.set(playerPos.x + relX, 86 + c.yOff, playerPos.z + relZ);
      _dummy.scale.set(c.sx, 1, c.sz);
      _dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    const showWeather = weather !== WeatherType.Clear;
    this.weatherMesh.visible = showWeather;
    if (showWeather) {
      const isSnow = weather === WeatherType.Snow;
      const mat = this.weatherMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(isSnow ? 0xffffff : 0x8cc2ff);
      mat.opacity = isSnow ? 0.85 : 0.62;
      const fallSpeed = isSnow ? 3.5 : weather === WeatherType.Storm ? 26 : 19;
      const count = this.isSoftwareGl ? 220 : WEATHER_COUNT;
      this.weatherMesh.count = count;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        this.weatherPositions[idx + 1] -= fallSpeed * this.weatherSpeeds[i] * dt;
        if (isSnow) this.weatherPositions[idx] += Math.sin(performance.now() * 0.002 + i) * dt * 0.8;
        if (this.weatherPositions[idx + 1] < -4) {
          this.weatherPositions[idx] = (Math.random() - 0.5) * 32;
          this.weatherPositions[idx + 1] = 20;
          this.weatherPositions[idx + 2] = (Math.random() - 0.5) * 32;
        }
        _dummy.position.set(
          playerPos.x + this.weatherPositions[idx],
          playerPos.y + this.weatherPositions[idx + 1],
          playerPos.z + this.weatherPositions[idx + 2],
        );
        _dummy.scale.set(isSnow ? 2.2 : 1, isSnow ? 0.22 : 1, isSnow ? 2.2 : 1);
        _dummy.updateMatrix();
        this.weatherMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.weatherMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as THREE.Material).dispose();
    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();
    this.cloudMesh.geometry.dispose();
    (this.cloudMesh.material as THREE.Material).dispose();
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.weatherMesh.geometry.dispose();
    (this.weatherMesh.material as THREE.Material).dispose();
  }
}

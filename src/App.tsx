import { useEffect, useRef, useState } from 'react';
import { CreativeInventoryModal } from './components/CreativeInventoryModal';
import { FunctionalBlockModal } from './components/FunctionalBlockModal';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { InventoryModal } from './components/InventoryModal';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { GameEngine } from './engine/GameEngine';
import { hasSavedWorld, loadWorldFromDb, saveWorldToDb } from './storage/worldSave';
import { BiomeId, GameMode, GamePhase, GameSettings, HudSnapshot, WeatherType, WorldSaveData } from './types/game';

const DEFAULT_SETTINGS: GameSettings = {
  renderDistance: 3,
  mouseSensitivity: 1.0,
  muted: false,
  fov: 72,
};

const EMPTY_HUD: HudSnapshot = {
  health: 20,
  maxHealth: 20,
  hunger: 20,
  maxHunger: 20,
  armor: 0,
  oxygen: 20,
  maxOxygen: 20,
  dayCount: 1,
  timeOfDay: 0.22,
  biome: BiomeId.Plains,
  weather: WeatherType.Clear,
  hotbar: new Array(9).fill(null),
  inventory: new Array(27).fill(null),
  armorSlots: { helmet: null, chestplate: null, leggings: null, boots: null },
  selectedSlot: 0,
  gameMode: 'survival',
  isFlying: false,
  pointerLocked: false,
  isInventoryOpen: false,
  cursorItem: null,
  craftingGrid: new Array(9).fill(null),
  activeBlockUi: null,
  activeBlockEntity: null,
  activePartnerChest: null,
  isNearCraftingTable: false,
  isNearFurnace: false,
  miningProgress: 0,
  targetBlockName: null,
  targetBlockHint: null,
  targetMobName: null,
  targetMobHp: 0,
  targetMobMaxHp: 0,
  playerCoords: { x: 0, y: 40, z: 0 },
  respawnCoords: null,
  blocksMined: 0,
  mobsDefeated: 0,
  statusMessage: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.Title);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [hasSave, setHasSave] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [worldConfig, setWorldConfig] = useState<{ key: number; seed: number; gameMode: GameMode; saved: WorldSaveData | null; autoPlay: boolean }>(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('gamemode');
    return {
      key: 0,
      seed: 202604,
      gameMode: modeParam === 'creative' ? 'creative' : 'survival',
      saved: null,
      autoPlay: params.get('autostart') === '1',
    };
  });

  useEffect(() => {
    hasSavedWorld().then(setHasSave).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  // Mount Three.js engine whenever a world session boots
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let engine: GameEngine | null = null;
    try {
      setEngineError(null);
      engine = new GameEngine(
        container,
        settings,
        (snap) => setHud(snap),
        (nextPhase) => setPhase(nextPhase),
        worldConfig.seed,
        worldConfig.saved,
        worldConfig.gameMode,
      );
      engineRef.current = engine;

      if (worldConfig.autoPlay) {
        engine.setPhase(GamePhase.Playing);
      }
    } catch (err) {
      engineRef.current = null;
      setEngineError(err instanceof Error ? err.message : 'Unable to initialize 3D WebGL renderer.');
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
    // Intentionally keyed on worldConfig.key so settings/HUD updates never tear down WebGL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldConfig.key]);

  // Bind Enter / Space on Title Screen to Start
  useEffect(() => {
    if (phase !== GamePhase.Title) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleStartNew(worldConfig.seed, worldConfig.gameMode);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleStartNew = (seed: number, gameMode: GameMode = 'survival') => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (seed === worldConfig.seed && !worldConfig.saved && engineRef.current) {
      engineRef.current.setGameMode(gameMode);
      engineRef.current.setPhase(GamePhase.Playing);
    } else {
      setWorldConfig((prev) => ({ key: prev.key + 1, seed, gameMode, saved: null, autoPlay: true }));
    }
  };

  const handleContinueSave = async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const saved = await loadWorldFromDb();
    if (saved) {
      setWorldConfig((prev) => ({ key: prev.key + 1, seed: saved.seed, gameMode: saved.gameMode ?? 'survival', saved, autoPlay: true }));
    }
  };

  const handleSaveWorld = async () => {
    if (!engineRef.current) return;
    await saveWorldToDb(engineRef.current.exportSaveData());
    setHasSave(true);
    setSaveFeedback('World saved locally.');
    setTimeout(() => setSaveFeedback(null), 2500);
  };

  const handleReturnTitle = async () => {
    if (engineRef.current) {
      await saveWorldToDb(engineRef.current.exportSaveData());
      setHasSave(true);
      engineRef.current.setPhase(GamePhase.Title);
    }
  };

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0d1117]">
      {/* Isolated WebGL canvas container */}
      <div ref={mountRef} data-testid="game-canvas" className="w-full h-full" />

      {engineError && (
        <div className="fixed top-4 right-4 z-50 voxel-panel max-w-sm rounded px-4 py-3 text-xs text-amber-200">
          3D Renderer notice: {engineError}
        </div>
      )}

      {phase === GamePhase.Title && (
        <TitleScreen
          hasSave={hasSave}
          onStartNew={handleStartNew}
          onContinueSave={handleContinueSave}
        />
      )}

      {phase === GamePhase.Playing && (
        <GameHud
          hud={hud}
          muted={settings.muted}
          onSelectSlot={(idx) => engineRef.current?.selectSlot(idx)}
          onToggleInventory={() => engineRef.current?.toggleInventory()}
          onToggleMute={() => handleUpdateSettings({ ...settings, muted: !settings.muted })}
          onPause={() => engineRef.current?.setPhase(GamePhase.Paused)}
        />
      )}

      {phase === GamePhase.Playing && hud.isInventoryOpen && (
        hud.activeBlockUi && hud.activeBlockUi.type !== 'crafting_table' ? (
          <FunctionalBlockModal
            hud={hud}
            onClose={() => engineRef.current?.toggleInventory(false)}
            onMutateContainer={(fn) => engineRef.current?.mutateContainer(fn)}
          />
        ) : hud.gameMode === 'creative' && hud.activeBlockUi?.type !== 'crafting_table' ? (
          <CreativeInventoryModal
            hud={hud}
            onClose={() => engineRef.current?.toggleInventory(false)}
            onMutateContainer={(fn) => engineRef.current?.mutateContainer(fn)}
          />
        ) : (
          <InventoryModal
            hud={hud}
            onClose={() => engineRef.current?.toggleInventory(false)}
            onCraftRecipe={(id) => engineRef.current?.craft(id)}
            onMutateContainer={(fn) => engineRef.current?.mutateContainer(fn)}
          />
        )
      )}

      {phase === GamePhase.Paused && (
        <PauseModal
          settings={settings}
          weather={hud.weather}
          gameMode={hud.gameMode}
          saveFeedback={saveFeedback}
          onResume={() => engineRef.current?.setPhase(GamePhase.Playing)}
          onSaveWorld={handleSaveWorld}
          onReturnTitle={handleReturnTitle}
          onUpdateSettings={handleUpdateSettings}
          onSetTimeWeather={(t, w) => engineRef.current?.setTimeAndWeather(t, w)}
          onSetGameMode={(mode) => engineRef.current?.setGameMode(mode)}
        />
      )}

      {phase === GamePhase.GameOver && (
        <GameOverModal
          hud={hud}
          onRespawn={() => engineRef.current?.respawnPlayer()}
          onReturnTitle={() => engineRef.current?.setPhase(GamePhase.Title)}
        />
      )}
    </div>
  );
}

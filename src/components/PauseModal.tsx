import React from 'react';
import { Home, Play, Save } from 'lucide-react';
import { GameMode, GameSettings, WeatherType } from '../types/game';

interface PauseModalProps {
  settings: GameSettings;
  weather: WeatherType;
  gameMode: GameMode;
  saveFeedback: string | null;
  onResume: () => void;
  onSaveWorld: () => void;
  onReturnTitle: () => void;
  onUpdateSettings: (next: GameSettings) => void;
  onSetTimeWeather: (timeOfDay?: number, weather?: WeatherType) => void;
  onSetGameMode: (mode: GameMode) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  settings,
  weather,
  gameMode,
  saveFeedback,
  onResume,
  onSaveWorld,
  onReturnTitle,
  onUpdateSettings,
  onSetTimeWeather,
  onSetGameMode,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md voxel-panel rounded p-6 text-stone-100">
        <h2 className="font-display font-bold text-2xl mb-1">Game Paused</h2>
        <p className="text-xs text-stone-400 mb-5">Adjust world rendering, controls, or save your progress.</p>

        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <label htmlFor="render-distance">Render Distance</label>
              <span className="font-mono-num text-amber-400">{settings.renderDistance} chunks</span>
            </div>
            <input
              id="render-distance"
              type="range"
              min={2}
              max={6}
              step={1}
              value={settings.renderDistance}
              onChange={(e) => onUpdateSettings({ ...settings, renderDistance: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <label htmlFor="mouse-sens">Mouse Sensitivity</label>
              <span className="font-mono-num text-amber-400">{settings.mouseSensitivity.toFixed(1)}×</span>
            </div>
            <input
              id="mouse-sens"
              type="range"
              min={0.4}
              max={2.0}
              step={0.1}
              value={settings.mouseSensitivity}
              onChange={(e) => onUpdateSettings({ ...settings, mouseSensitivity: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-stone-700/80">
            <div className="text-xs font-medium text-stone-300 mb-2">Game Mode</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['survival', 'creative'] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSetGameMode(mode)}
                  aria-pressed={gameMode === mode}
                  className={`px-3 py-1.5 text-xs font-medium rounded border capitalize cursor-pointer ${
                    gameMode === mode
                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                      : 'bg-[#232936] hover:bg-stone-700 text-stone-200 border-stone-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="text-xs font-medium text-stone-300 mb-2">World Environment</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => onSetTimeWeather(0.25, undefined)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-[#232936] hover:bg-stone-700 border border-stone-600 cursor-pointer"
              >
                Set Noon
              </button>
              <button
                type="button"
                onClick={() => onSetTimeWeather(0.75, undefined)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-[#232936] hover:bg-stone-700 border border-stone-600 cursor-pointer"
              >
                Set Midnight
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([WeatherType.Clear, WeatherType.Rain, WeatherType.Snow, WeatherType.Storm] as WeatherType[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSetTimeWeather(undefined, w)}
                  className={`px-2 py-1.5 text-xs font-medium rounded border capitalize cursor-pointer ${
                    weather === w
                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                      : 'bg-[#232936] hover:bg-stone-700 text-stone-200 border-stone-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>

        {saveFeedback && (
          <div className="mb-3 px-3 py-2 rounded bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-300">
            {saveFeedback}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 w-full py-2.5 voxel-btn-amber font-display font-bold text-sm rounded cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Game</span>
          </button>
          <button
            type="button"
            onClick={onSaveWorld}
            className="flex items-center justify-center gap-2 w-full py-2.5 voxel-btn-stone font-semibold text-sm rounded cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save World</span>
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="flex items-center justify-center gap-2 w-full py-2.5 voxel-btn-stone text-stone-300 font-semibold text-sm rounded cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Save & Quit to Title</span>
          </button>
        </div>
      </div>
    </div>
  );
};

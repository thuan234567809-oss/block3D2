import React, { useState } from 'react';
import { Compass, Hammer, Play, RotateCcw } from 'lucide-react';
import { GameMode } from '../types/game';

interface TitleScreenProps {
  hasSave: boolean;
  onStartNew: (seed: number, gameMode: GameMode) => void;
  onContinueSave: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  onStartNew,
  onContinueSave,
}) => {
  const [seedInput, setSeedInput] = useState('202604');
  const [selectedMode, setSelectedMode] = useState<GameMode>('survival');

  const handleStart = () => {
    const parsed = parseInt(seedInput.trim(), 10);
    const seed = Number.isFinite(parsed) ? parsed : Math.abs(seedInput.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    onStartNew(seed || 202604, selectedMode);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-8 md:p-12 pointer-events-none bg-gradient-to-r from-black/75 via-black/35 to-transparent">
      <div className="max-w-lg my-auto pointer-events-auto">
        <div className="mb-6">
          <svg
            viewBox="0 0 392 88"
            className="w-80 md:w-96 h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
            aria-label="BLOCKWORLD"
          >
            <g transform="translate(4, 8)">
              <polygon points="32,4 60,18 32,32 4,18" fill="#5eb846" stroke="#1b2418" strokeWidth="2.5" />
              <polygon points="4,18 32,32 32,64 4,50" fill="#7d5634" stroke="#1b2418" strokeWidth="2.5" />
              <polygon points="60,18 32,32 32,64 60,50" fill="#5e3e23" stroke="#1b2418" strokeWidth="2.5" />
              <polygon points="4,18 32,32 32,40 4,26" fill="#469632" />
              <polygon points="60,18 32,32 32,40 60,26" fill="#3a7d29" />
            </g>
            <text
              x="78"
              y="48"
              fill="#f8fafc"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="40"
              letterSpacing="2"
            >
              BLOCKWORLD
            </text>
            <text
              x="80"
              y="70"
              fill="#cbd5e1"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="600"
              fontSize="13"
              letterSpacing="3.5"
            >
              3D SANDBOX SURVIVAL
            </text>
          </svg>
        </div>

        <p className="text-stone-200/95 text-sm md:text-base leading-relaxed mb-7 max-w-md hud-text-shadow">
          Explore 8 procedural biomes, mine deep cavern ores, craft 3D tools and armor, build shelters, or fly freely in Creative Mode.
        </p>

        <div className="flex flex-col gap-3 max-w-xs">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Game Mode">
            <button
              type="button"
              onClick={() => setSelectedMode('survival')}
              aria-pressed={selectedMode === 'survival'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-display font-bold rounded cursor-pointer ${
                selectedMode === 'survival' ? 'voxel-btn-amber' : 'voxel-btn-stone text-stone-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Survival</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode('creative')}
              aria-pressed={selectedMode === 'creative'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-display font-bold rounded cursor-pointer ${
                selectedMode === 'creative' ? 'voxel-btn-amber' : 'voxel-btn-stone text-stone-300'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Creative</span>
            </button>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={handleStart}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 voxel-btn-amber font-display font-bold text-base tracking-wide rounded transition-transform cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{hasSave ? `New ${selectedMode === 'creative' ? 'Creative' : 'Survival'} World` : 'Enter World'}</span>
          </button>

          {hasSave && (
            <button
              type="button"
              onClick={onContinueSave}
              className="flex items-center justify-center gap-2 px-5 py-3 voxel-btn-stone font-display font-semibold text-sm tracking-wide rounded transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Continue Saved World</span>
            </button>
          )}

          <div className="mt-1 flex items-center gap-2">
            <label htmlFor="world-seed" className="text-xs font-medium text-stone-300 whitespace-nowrap hud-text-shadow">
              World Seed
            </label>
            <input
              id="world-seed"
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono-num voxel-inset rounded text-stone-100 focus:outline-none focus:border-amber-400"
              placeholder="202604"
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-stone-300/95 hud-text-shadow flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>WASD Move</span>
        <span aria-hidden="true">·</span>
        <span>Space Jump / 2×Fly</span>
        <span aria-hidden="true">·</span>
        <span>LMB Mine / Attack</span>
        <span aria-hidden="true">·</span>
        <span>RMB Place / Eat</span>
        <span aria-hidden="true">·</span>
        <span>E Inventory</span>
        <span aria-hidden="true">·</span>
        <span>Q Drop</span>
        <span aria-hidden="true">·</span>
        <span>1-9 Hotbar</span>
        <span aria-hidden="true">·</span>
        <span>Esc Pause</span>
      </div>
    </div>
  );
};

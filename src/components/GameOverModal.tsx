import React from 'react';
import { Home, RotateCcw } from 'lucide-react';
import { HudSnapshot } from '../types/game';

interface GameOverModalProps {
  hud: HudSnapshot;
  onRespawn: () => void;
  onReturnTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  hud,
  onRespawn,
  onReturnTitle,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-red-950/75 p-4">
      <div className="w-full max-w-md voxel-panel border-red-500/50 rounded p-6 text-stone-100 text-center">
        <h2 className="font-display font-bold text-3xl text-red-400 mb-1">You Died</h2>
        <p className="text-xs text-stone-400 mb-6">Your survival run ended in the wild.</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="voxel-inset rounded p-3">
            <div className="text-[11px] text-stone-400">Day Reached</div>
            <div className="text-xl font-mono-num font-bold text-amber-400 mt-0.5">{hud.dayCount}</div>
          </div>
          <div className="voxel-inset rounded p-3">
            <div className="text-[11px] text-stone-400">Blocks Mined</div>
            <div className="text-xl font-mono-num font-bold text-stone-100 mt-0.5">{hud.blocksMined}</div>
          </div>
          <div className="voxel-inset rounded p-3">
            <div className="text-[11px] text-stone-400">Mobs Slain</div>
            <div className="text-xl font-mono-num font-bold text-stone-100 mt-0.5">{hud.mobsDefeated}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onRespawn}
            className="flex items-center justify-center gap-2 w-full py-3 voxel-btn-amber font-display font-bold text-sm rounded cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Respawn in World</span>
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="flex items-center justify-center gap-2 w-full py-2.5 voxel-btn-stone text-stone-200 font-semibold text-sm rounded cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Title</span>
          </button>
        </div>
      </div>
    </div>
  );
};

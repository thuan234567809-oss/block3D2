import React from 'react';
import { Backpack, Pause, Volume2, VolumeX } from 'lucide-react';
import { ITEMS } from '../data/items';
import { getItemIconDataUrl } from '../render/textures';
import { HudSnapshot } from '../types/game';
import { BIOMES } from '../world/biome';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onSelectSlot: (idx: number) => void;
  onToggleInventory: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

function formatClock(t: number): string {
  const hoursFloat = (t * 24 + 6) % 24;
  const hh = Math.floor(hoursFloat);
  const mm = Math.floor((hoursFloat - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const PixelHeart: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 9 9" shapeRendering="crispEdges" className="w-4 h-4">
    <path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1z" fill="#090d14" />
    {state !== 'empty' && (
      <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1z" fill={state === 'full' ? '#ef4444' : '#f87171'} />
    )}
    {state === 'empty' && <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1z" fill="#1e2533" />}
    {state !== 'empty' && <rect x="2" y="3" width="1" height="1" fill="#fecaca" />}
  </svg>
);

const PixelDrumstick: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 9 9" shapeRendering="crispEdges" className="w-4 h-4">
    <path d="M4 0h3v1h2v3H8v1H7v1H5V5H4v2H2v1H1V7H0V6h1V5h2V4h1V2H3V1h1z" fill="#090d14" />
    <path
      d="M4 1h3v1h1v2H7v1H5V4H4z"
      fill={state === 'full' ? '#d97706' : state === 'half' ? '#fbbf24' : '#1e2533'}
    />
    {state !== 'empty' && <rect x="5" y="2" width="1" height="1" fill="#fde68a" />}
    <path d="M3 4h1v2H2v1H1V6h2z" fill={state === 'empty' ? '#334155' : '#e7e5e4'} />
  </svg>
);

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  onSelectSlot,
  onToggleInventory,
  onToggleMute,
  onPause,
}) => {
  const heldSlot = hud.hotbar[hud.selectedSlot];
  const heldName = heldSlot ? ITEMS[heldSlot.itemId]?.name ?? '' : '';
  const biomeName = BIOMES[hud.biome]?.name ?? hud.biome;
  const weatherLabel =
    hud.weather === 'clear' ? 'Clear' : hud.weather === 'rain' ? 'Rain' : hud.weather === 'snow' ? 'Snow' : 'Thunderstorm';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="voxel-panel rounded px-3.5 py-2 text-xs text-stone-100">
          <div className="flex items-center gap-2.5 font-mono-num">
            <span className="font-display font-bold text-amber-400">Day {hud.dayCount}</span>
            <span aria-hidden="true" className="text-stone-500">·</span>
            <span>{formatClock(hud.timeOfDay)}</span>
            <span aria-hidden="true" className="text-stone-500">·</span>
            <span>{biomeName}</span>
            <span aria-hidden="true" className="text-stone-500">·</span>
            <span>{weatherLabel}</span>
            {hud.gameMode === 'creative' && (
              <>
                <span aria-hidden="true" className="text-stone-500">·</span>
                <span className="font-display font-bold text-sky-300">Creative</span>
              </>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-400 font-mono-num flex items-center gap-2">
            <span>XYZ {hud.playerCoords.x} / {hud.playerCoords.y} / {hud.playerCoords.z}</span>
            {hud.isFlying && <span className="text-amber-300 font-semibold">· Flying</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Open Inventory (E)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleInventory();
            }}
            className="w-10 h-10 flex items-center justify-center rounded voxel-btn-stone cursor-pointer"
          >
            <Backpack className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-10 h-10 flex items-center justify-center rounded voxel-btn-stone cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Game (Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-10 h-10 flex items-center justify-center rounded voxel-btn-stone cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!hud.isInventoryOpen && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
          <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className="w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
            <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" fill="#ffffff" fillOpacity="0.92" />
          </svg>
          {hud.miningProgress > 0.02 && (
            <div className="mt-2 w-20 h-2 voxel-inset rounded-sm overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.min(100, Math.round(hud.miningProgress * 100))}%` }}
              />
            </div>
          )}
          {(hud.targetBlockName || hud.targetMobName) && (
            <div className="mt-3 px-2.5 py-1 rounded voxel-panel text-[11px] font-medium text-stone-100 text-center">
              {hud.targetMobName ? (
                <span>
                  {hud.targetMobName} ({Math.ceil(hud.targetMobHp)}/{hud.targetMobMaxHp})
                </span>
              ) : (
                <div className="flex flex-col items-center">
                  <span>{hud.targetBlockName}</span>
                  {hud.targetBlockHint && (
                    <span className="text-[10px] text-amber-300">{hud.targetBlockHint}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hud.statusMessage && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded voxel-panel border-amber-500/60 text-xs font-medium text-amber-200 pointer-events-none">
          {hud.statusMessage}
        </div>
      )}

      {!hud.isInventoryOpen && (
        <div className="mx-auto flex flex-col items-center gap-1.5">
          {heldName && (
            <div className="text-xs font-display font-semibold text-stone-100 hud-text-shadow mb-0.5 tracking-wide">
              {heldName}
            </div>
          )}

          {hud.gameMode === 'creative' ? (
            <div className="w-full max-w-[446px] flex items-center justify-between gap-4 px-1 text-[11px] font-mono-num hud-text-shadow whitespace-nowrap">
              <span className="text-sky-300 font-semibold">Creative · Invulnerable</span>
              <span className="text-stone-300">
                {hud.isFlying ? 'Flying · Space Up · Shift Down' : '2×Space Fly'}
              </span>
            </div>
          ) : (
            <div className="w-full max-w-[446px] flex items-center justify-between px-1">
              <div className="flex flex-col gap-1">
                {hud.armor > 0 && (
                  <div className="flex items-center gap-1 text-[11px] font-mono-num text-sky-300 hud-text-shadow">
                    <svg viewBox="0 0 9 9" shapeRendering="crispEdges" className="w-3.5 h-3.5">
                      <path d="M4 0h1l3 1v4L5 8H4L1 5V1z" fill="#090d14" />
                      <path d="M4 1h1l2 1v3L5 7H4L2 5V2z" fill="#7dd3fc" />
                    </svg>
                    <span>{hud.armor} Armor</span>
                  </div>
                )}
                <div className="flex items-center gap-0.5" aria-label={`Health ${hud.health} of ${hud.maxHealth}`}>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const full = hud.health >= (i + 1) * 2;
                    const half = !full && hud.health === i * 2 + 1;
                    return <PixelHeart key={i} state={full ? 'full' : half ? 'half' : 'empty'} />;
                  })}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {hud.oxygen < hud.maxOxygen && (
                  <div className="text-[11px] font-mono-num text-cyan-300 hud-text-shadow">
                    O₂ {Math.round((hud.oxygen / hud.maxOxygen) * 100)}%
                  </div>
                )}
                <div className="flex items-center gap-0.5" aria-label={`Hunger ${hud.hunger} of ${hud.maxHunger}`}>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const full = hud.hunger >= (i + 1) * 2;
                    const half = !full && hud.hunger === i * 2 + 1;
                    return <PixelDrumstick key={i} state={full ? 'full' : half ? 'half' : 'empty'} />;
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 p-1.5 voxel-panel rounded pointer-events-auto">
            {hud.hotbar.map((slot, idx) => {
              const active = idx === hud.selectedSlot;
              const def = slot ? ITEMS[slot.itemId] : undefined;
              const maxDur = def?.durability ?? 0;
              const durPct = slot?.durability && maxDur ? Math.max(0, (slot.durability / maxDur) * 100) : null;

              return (
                <button
                  key={idx}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Hotbar slot ${idx + 1}${def ? `: ${def.name}` : ''}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectSlot(idx);
                  }}
                  className={`relative w-11 h-11 rounded-sm flex items-center justify-center transition-transform cursor-pointer ${
                    active ? 'voxel-slot-active scale-105' : 'voxel-slot'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-mono-num text-stone-400">
                    {idx + 1}
                  </span>
                  {slot && (
                    <>
                      <img
                        src={getItemIconDataUrl(slot.itemId)}
                        alt={def?.name ?? slot.itemId}
                        className="w-7 h-7 pixelated"
                      />
                      {slot.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[11px] font-mono-num font-bold text-white hud-text-shadow">
                          {slot.count}
                        </span>
                      )}
                      {durPct !== null && (
                        <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-black/75 overflow-hidden">
                          <div
                            className={`h-full ${durPct > 45 ? 'bg-emerald-400' : durPct > 20 ? 'bg-amber-400' : 'bg-red-500'}`}
                            style={{ width: `${durPct}%` }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

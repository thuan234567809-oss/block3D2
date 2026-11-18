import React from 'react';
import { ITEMS } from '../data/items';
import { InventorySlot } from '../types/game';

interface ItemTooltipProps {
  slot: InventorySlot | null;
  x: number;
  y: number;
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({ slot, x, y }) => {
  if (!slot) return null;
  const def = ITEMS[slot.itemId];
  if (!def) return null;

  const left = Math.min(x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 250);
  const top = Math.min(y + 14, (typeof window !== 'undefined' ? window.innerHeight : 720) - 170);

  return (
    <div
      className="fixed z-50 pointer-events-none w-56 rounded voxel-panel px-3 py-2 text-xs text-stone-100"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-bold text-amber-300 truncate">{def.name}</span>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-stone-800 border border-stone-700 text-stone-300 shrink-0">
          {def.category}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-stone-300 leading-snug">{def.description}</p>
      <div className="mt-1.5 pt-1.5 border-t border-stone-800 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono-num text-stone-400">
        <span>Max Stack: {def.maxStack}</span>
        {def.durability !== undefined && slot.durability !== undefined && (
          <span className="text-emerald-300">
            Durability: {slot.durability}/{def.durability}
          </span>
        )}
        {def.attackDamage !== undefined && <span className="text-rose-300">ATK +{def.attackDamage}</span>}
        {def.miningSpeed !== undefined && <span className="text-sky-300">Speed {def.miningSpeed}×</span>}
        {def.armorDefense !== undefined && <span className="text-sky-300">DEF +{def.armorDefense}</span>}
        {def.hungerRestore !== undefined && <span className="text-amber-300">Food +{def.hungerRestore}</span>}
        {def.fuelBurnSec !== undefined && <span className="text-orange-300">Fuel {def.fuelBurnSec}s</span>}
      </div>
    </div>
  );
};

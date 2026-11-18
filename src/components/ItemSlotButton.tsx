import React from 'react';
import { ITEMS } from '../data/items';
import { getItemIconDataUrl } from '../render/textures';
import { InventorySlot } from '../types/game';

interface ItemSlotButtonProps {
  slot: InventorySlot | null;
  label: string;
  placeholder?: string;
  highlighted?: boolean;
  onMouseDownSlot: (e: React.MouseEvent) => void;
  onMouseEnterSlot: (e: React.MouseEvent) => void;
  onMouseLeaveSlot: () => void;
}

export const ItemSlotButton: React.FC<ItemSlotButtonProps> = ({
  slot,
  label,
  placeholder,
  highlighted = false,
  onMouseDownSlot,
  onMouseEnterSlot,
  onMouseLeaveSlot,
}) => {
  const def = slot ? ITEMS[slot.itemId] : undefined;
  const maxDur = def?.durability ?? 0;
  const durPct = slot?.durability !== undefined && maxDur > 0 ? Math.max(0, (slot.durability / maxDur) * 100) : null;

  const accessibleLabel = slot ? `${label}: ${def?.name ?? slot.itemId} x${slot.count}` : label;

  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMouseDownSlot(e);
      }}
      onMouseEnter={onMouseEnterSlot}
      onMouseLeave={onMouseLeaveSlot}
      className={`relative w-11 h-11 rounded-sm flex items-center justify-center select-none cursor-pointer transition-colors ${
        highlighted ? 'voxel-slot-active' : 'voxel-slot'
      }`}
    >
      {slot ? (
        <>
          <img
            src={getItemIconDataUrl(slot.itemId)}
            alt={def?.name ?? slot.itemId}
            draggable={false}
            className="w-7 h-7 pixelated pointer-events-none"
          />
          {slot.count > 1 && (
            <span className="absolute bottom-0.5 right-1 text-[11px] font-mono-num font-bold text-white hud-text-shadow pointer-events-none">
              {slot.count}
            </span>
          )}
          {durPct !== null && (
            <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-black/75 overflow-hidden pointer-events-none">
              <div
                className={`h-full ${durPct > 45 ? 'bg-emerald-400' : durPct > 20 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${durPct}%` }}
              />
            </div>
          )}
        </>
      ) : (
        placeholder && <span className="text-[10px] text-stone-500 pointer-events-none">{placeholder}</span>
      )}
    </button>
  );
};

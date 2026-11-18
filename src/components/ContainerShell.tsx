import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ContainerArea, ContainerController } from '../engine/ContainerController';
import { ITEMS } from '../data/items';
import { PlayerInventoryState } from '../player/inventory';
import { getItemIconDataUrl } from '../render/textures';
import { HudSnapshot, InventorySlot } from '../types/game';
import { WorldManager } from '../world/worldManager';
import { ItemSlotButton } from './ItemSlotButton';
import { ItemTooltip } from './ItemTooltip';

export type MutateContainerFn = (
  fn: (c: ContainerController, inv: PlayerInventoryState, world: WorldManager) => boolean,
) => void;

interface ContainerShellProps {
  hud: HudSnapshot;
  title: string;
  subtitle: string;
  maxWidthClass?: string;
  onClose: () => void;
  onMutate: MutateContainerFn;
  children: (helpers: {
    renderAreaSlot: (
      area: ContainerArea,
      idx: number,
      slot: InventorySlot | null,
      label: string,
      placeholder?: string,
    ) => React.ReactNode;
    setHovered: (slot: InventorySlot | null) => void;
  }) => React.ReactNode;
}

export const ContainerShell: React.FC<ContainerShellProps> = ({
  hud,
  title,
  subtitle,
  maxWidthClass = 'max-w-4xl',
  onClose,
  onMutate,
  children,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredSlot, setHoveredSlot] = useState<InventorySlot | null>(null);
  const [draggingButton, setDraggingButton] = useState<0 | 2 | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    const onUp = () => {
      if (draggingButton !== null) {
        onMutate((c) => {
          c.endDrag();
          return true;
        });
        setDraggingButton(null);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingButton, onMutate]);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (hud.cursorItem) {
      const btn: 0 | 2 = e.button === 2 ? 2 : 0;
      onMutate((c) => c.dropCursorOutside(btn));
    }
  };

  const renderAreaSlot = (
    area: ContainerArea,
    idx: number,
    slot: InventorySlot | null,
    label: string,
    placeholder?: string,
  ) => (
    <ItemSlotButton
      slot={slot}
      label={label}
      placeholder={placeholder}
      onMouseDownSlot={(e) => {
        const btn: 0 | 2 = e.button === 2 ? 2 : 0;
        if (e.shiftKey && btn === 0) {
          onMutate((c, inv, w) => c.clickSlot(area, idx, 0, true, inv, w));
          return;
        }
        if (hud.cursorItem) {
          setDraggingButton(btn);
          onMutate((c, inv, w) => c.beginDrag(area, idx, btn, inv, w));
        } else {
          onMutate((c, inv, w) => c.clickSlot(area, idx, btn, false, inv, w));
        }
      }}
      onMouseEnterSlot={() => {
        setHoveredSlot(slot);
        if (draggingButton !== null) {
          onMutate((c, inv, w) => c.continueDrag(area, idx, inv, w));
        }
      }}
      onMouseLeaveSlot={() => setHoveredSlot(null)}
    />
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClass} voxel-panel rounded p-5 text-stone-100 max-h-[92vh] overflow-y-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-700 pb-3 mb-4">
          <div>
            <h2 className="font-display font-bold text-xl">{title}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close Container"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded voxel-btn-stone cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {children({ renderAreaSlot, setHovered: setHoveredSlot })}

        {/* Unified Player Backpack & Hotbar */}
        <div className="mt-5 pt-4 border-t border-stone-700/80 space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-stone-400 mb-1.5">
              Backpack (LMB: Pick/Place/Merge · RMB: Half/Place 1 · Drag: Distribute · Shift+Click: Quick Move)
            </div>
            <div className="grid grid-cols-9 gap-1.5 w-fit">
              {hud.inventory.map((slot, idx) => (
                <React.Fragment key={idx}>
                  {renderAreaSlot('inventory', idx, slot, `Backpack slot ${idx + 1}`)}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-stone-400 mb-1.5">Hotbar</div>
            <div className="grid grid-cols-9 gap-1.5 w-fit">
              {hud.hotbar.map((slot, idx) => (
                <React.Fragment key={idx}>
                  {renderAreaSlot('hotbar', idx, slot, `Hotbar slot ${idx + 1}`)}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tooltip (only when cursor is empty) */}
      {!hud.cursorItem && hoveredSlot && <ItemTooltip slot={hoveredSlot} x={mousePos.x} y={mousePos.y} />}

      {/* Floating Held Cursor Stack */}
      {hud.cursorItem && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          <img
            src={getItemIconDataUrl(hud.cursorItem.itemId)}
            alt={ITEMS[hud.cursorItem.itemId]?.name}
            className="w-8 h-8 pixelated drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
          />
          {hud.cursorItem.count > 1 && (
            <span className="absolute bottom-0 right-0.5 text-xs font-mono-num font-bold text-white hud-text-shadow">
              {hud.cursorItem.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

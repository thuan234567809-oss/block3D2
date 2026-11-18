import React from 'react';
import { Flame, Hammer } from 'lucide-react';
import { ITEMS } from '../data/items';
import { getItemIconDataUrl } from '../render/textures';
import { HudSnapshot } from '../types/game';
import { computeAnvilPreview } from '../world/blockEntities';
import { ContainerShell, MutateContainerFn } from './ContainerShell';

interface FunctionalBlockModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onMutateContainer: MutateContainerFn;
}

export const FunctionalBlockModal: React.FC<FunctionalBlockModalProps> = ({
  hud,
  onClose,
  onMutateContainer,
}) => {
  const entity = hud.activeBlockEntity;
  if (!entity) return null;

  const isLargeChest = entity.type === 'chest' && hud.activePartnerChest !== null;
  const title =
    entity.type === 'furnace'
      ? 'Furnace'
      : isLargeChest
        ? 'Large Chest (54 Slots)'
        : entity.type === 'chest'
          ? 'Chest (27 Slots)'
          : entity.type === 'barrel'
            ? 'Barrel (27 Slots)'
            : 'Anvil — Repair & Combine';

  const subtitle =
    entity.type === 'furnace'
      ? 'Insert ore or raw food above, Coal/Wood fuel below'
      : entity.type === 'anvil'
        ? 'Combine damaged gear with repair materials or a matching item'
        : 'Drag, split (RMB), or Shift+Click items between storage and inventory';

  return (
    <ContainerShell
      hud={hud}
      title={title}
      subtitle={subtitle}
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      onMutate={onMutateContainer}
    >
      {({ renderAreaSlot, setHovered }) => {
        if (entity.type === 'chest' || entity.type === 'barrel') {
          const slots =
            entity.type === 'chest' && hud.activePartnerChest
              ? [...entity.slots, ...hud.activePartnerChest.slots]
              : entity.slots;
          return (
            <div className="voxel-inset rounded p-3.5 w-fit">
              <div className="grid grid-cols-9 gap-1.5">
                {slots.map((slot, idx) => (
                  <React.Fragment key={idx}>
                    {renderAreaSlot('chest', idx, slot, `Storage slot ${idx + 1}`)}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        }

        if (entity.type === 'furnace') {
          const fuelPct = entity.maxBurnTime > 0 ? Math.min(100, (entity.burnTime / entity.maxBurnTime) * 100) : 0;
          const cookPct = entity.cookDuration > 0 ? Math.min(100, (entity.cookProgress / entity.cookDuration) * 100) : 0;

          return (
            <div className="voxel-inset rounded p-5 flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-2">
                {renderAreaSlot('furnace_in', 0, entity.input, 'Furnace Input', 'Ore/Food')}
                <div className="flex items-center gap-1.5" aria-label={`Fuel ${Math.round(fuelPct)}%`}>
                  <Flame className={`w-4 h-4 ${fuelPct > 0 ? 'text-orange-400' : 'text-stone-600'}`} />
                  <div className="w-10 h-2 bg-black/70 border border-stone-700 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all" style={{ width: `${fuelPct}%` }} />
                  </div>
                </div>
                {renderAreaSlot('furnace_fuel', 0, entity.fuel, 'Furnace Fuel', 'Fuel')}
              </div>

              {/* Smelt Progress Arrow */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-24 h-3 bg-black/70 border border-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${cookPct}%` }}
                    aria-label={`Smelting progress ${Math.round(cookPct)}%`}
                  />
                </div>
                <span className="text-[10px] font-mono-num text-stone-400">
                  {entity.burnTime > 0 ? `${Math.round(cookPct)}%` : 'Idle'}
                </span>
              </div>

              {/* Output Slot */}
              <button
                type="button"
                disabled={!entity.output}
                aria-label="Furnace Output"
                onContextMenu={(e) => e.preventDefault()}
                onMouseEnter={() => setHovered(entity.output)}
                onMouseLeave={() => setHovered(null)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMutateContainer((c, inv, w) => c.takeFurnaceOutput(inv, w, e.shiftKey));
                }}
                className="relative w-12 h-12 rounded-sm voxel-slot border-amber-500/80 disabled:border-stone-800 disabled:opacity-45 flex items-center justify-center cursor-pointer"
              >
                {entity.output ? (
                  <>
                    <img
                      src={getItemIconDataUrl(entity.output.itemId)}
                      alt={ITEMS[entity.output.itemId]?.name}
                      draggable={false}
                      className="w-8 h-8 pixelated pointer-events-none"
                    />
                    {entity.output.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 text-[11px] font-mono-num font-bold pointer-events-none">
                        {entity.output.count}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-stone-500">Out</span>
                )}
              </button>
            </div>
          );
        }

        if (entity.type === 'anvil') {
          const preview = computeAnvilPreview(entity.left, entity.right);
          return (
            <div className="voxel-inset rounded p-5 flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                {renderAreaSlot('anvil_left', 0, entity.left, 'Anvil Gear Slot', 'Gear')}
                <span className="text-stone-400 font-bold text-lg">+</span>
                {renderAreaSlot('anvil_right', 0, entity.right, 'Anvil Material Slot', 'Mat')}
                <span className="text-stone-400 font-bold text-lg">→</span>
                <button
                  type="button"
                  disabled={!preview}
                  aria-label="Anvil Repaired Output"
                  onContextMenu={(e) => e.preventDefault()}
                  onMouseEnter={() => setHovered(preview?.result ?? null)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMutateContainer((c, inv, w) => c.takeAnvilOutput(inv, w, e.shiftKey));
                  }}
                  className="relative w-12 h-12 rounded-sm voxel-slot border-amber-500/80 disabled:border-stone-800 disabled:opacity-45 flex items-center justify-center cursor-pointer"
                >
                  {preview ? (
                    <img
                      src={getItemIconDataUrl(preview.result.itemId)}
                      alt={ITEMS[preview.result.itemId]?.name}
                      draggable={false}
                      className="w-8 h-8 pixelated pointer-events-none"
                    />
                  ) : (
                    <Hammer className="w-4 h-4 text-stone-600" />
                  )}
                </button>
              </div>
              <div className="text-xs font-mono-num text-amber-300">
                {preview ? preview.costLabel : 'Place damaged tool/armor + matching material or duplicate'}
              </div>
            </div>
          );
        }

        return null;
      }}
    </ContainerShell>
  );
};

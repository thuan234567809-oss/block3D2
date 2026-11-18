import React, { useMemo } from 'react';
import { Hammer, Shield } from 'lucide-react';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { canCraftRecipe, getRecipeIngredients, matchCraftingGrid } from '../player/inventory';
import { getItemIconDataUrl } from '../render/textures';
import { ArmorSlotType, HudSnapshot, InventorySlot } from '../types/game';
import { ContainerShell, MutateContainerFn } from './ContainerShell';

interface InventoryModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onCraftRecipe: (recipeId: string) => void;
  onMutateContainer: MutateContainerFn;
}

const ARMOR_SLOTS: { key: ArmorSlotType; label: string }[] = [
  { key: 'helmet', label: 'Head' },
  { key: 'chestplate', label: 'Chest' },
  { key: 'leggings', label: 'Legs' },
  { key: 'boots', label: 'Feet' },
];

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  onClose,
  onCraftRecipe,
  onMutateContainer,
}) => {
  const isTable = hud.activeBlockUi?.type === 'crafting_table';
  const gridSize: 2 | 3 = isTable ? 3 : 2;

  const invState = useMemo(
    () => ({
      hotbar: hud.hotbar,
      inventory: hud.inventory,
      armorSlots: hud.armorSlots,
      selectedSlot: hud.selectedSlot,
    }),
    [hud],
  );

  const gridIds = useMemo(() => {
    const out: (string | null)[] = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        out.push(hud.craftingGrid[r * gridSize + c]?.itemId ?? null);
      }
    }
    return out;
  }, [hud.craftingGrid, gridSize]);

  const gridMatch = useMemo(() => matchCraftingGrid(gridIds, gridSize), [gridIds, gridSize]);
  const outputSlot: InventorySlot | null = gridMatch
    ? {
        itemId: gridMatch.resultItemId,
        count: gridMatch.resultCount,
        durability: ITEMS[gridMatch.resultItemId]?.durability,
      }
    : null;

  return (
    <ContainerShell
      hud={hud}
      title={isTable ? 'Crafting Table' : 'Inventory & Crafting'}
      subtitle={
        isTable
          ? '3×3 Crafting Grid — drag or split ingredients to craft tools, armor & stations'
          : '2×2 Hand Crafting — place & right-click a Crafting Table for 3×3 recipes'
      }
      onClose={onClose}
      onMutate={onMutateContainer}
    >
      {({ renderAreaSlot, setHovered }) => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Armor & Real Interactive Crafting Grid */}
          <div className="lg:col-span-7 flex flex-wrap items-start gap-6 voxel-inset rounded p-4">
            {/* Armor Slots */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 mb-2">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>Armor ({hud.armor} DEF)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ARMOR_SLOTS.map(({ key, label }, idx) => (
                  <React.Fragment key={key}>
                    {renderAreaSlot('armor', idx, hud.armorSlots[key], `Armor ${label}`, label)}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Interactive Crafting Grid */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 mb-2">
                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                <span>{gridSize}×{gridSize} Crafting Grid</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: gridSize * gridSize }).map((_, idx) => (
                    <React.Fragment key={idx}>
                      {renderAreaSlot('craft', idx, hud.craftingGrid[idx] ?? null, `Crafting cell ${idx + 1}`)}
                    </React.Fragment>
                  ))}
                </div>
                <span className="text-stone-400 font-bold text-lg">→</span>
                <button
                  type="button"
                  disabled={!outputSlot}
                  aria-label="Craft output"
                  onContextMenu={(e) => e.preventDefault()}
                  onMouseEnter={() => setHovered(outputSlot)}
                  onMouseLeave={() => setHovered(null)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMutateContainer((c, inv) => c.takeCraftingOutput(inv, e.shiftKey));
                  }}
                  className="relative w-12 h-12 rounded-sm voxel-slot border-amber-500/80 disabled:border-stone-800 disabled:opacity-45 flex items-center justify-center cursor-pointer"
                >
                  {outputSlot && (
                    <>
                      <img
                        src={getItemIconDataUrl(outputSlot.itemId)}
                        alt={ITEMS[outputSlot.itemId]?.name}
                        draggable={false}
                        className="w-8 h-8 pixelated pointer-events-none"
                      />
                      {outputSlot.count > 1 && (
                        <span className="absolute bottom-0.5 right-1 text-[11px] font-mono-num font-bold pointer-events-none">
                          {outputSlot.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Quick Recipe Book */}
          <div className="lg:col-span-5 voxel-inset rounded p-3.5 flex flex-col max-h-[260px]">
            <h3 className="font-display font-bold text-sm text-stone-200 mb-2">Quick Craft Recipes</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {RECIPES.map((recipe) => {
                const craftable = canCraftRecipe(invState, recipe, hud.isNearCraftingTable);
                const result = ITEMS[recipe.resultItemId];
                const reqs = getRecipeIngredients(recipe);
                return (
                  <div
                    key={recipe.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded border ${
                      craftable
                        ? 'bg-[#232936] border-amber-500/40'
                        : 'bg-[#171b24] border-stone-800 opacity-65'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={getItemIconDataUrl(recipe.resultItemId)}
                        alt={result?.name}
                        className="w-6 h-6 pixelated shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-100 truncate">
                          {result?.name} {recipe.resultCount > 1 ? `×${recipe.resultCount}` : ''}
                        </div>
                        <div className="text-[10px] text-stone-400 truncate">
                          {Object.entries(reqs)
                            .map(([id, cnt]) => `${cnt}× ${ITEMS[id]?.name ?? id}`)
                            .join(', ')}
                          {recipe.requiresTable ? ' · Table' : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!craftable}
                      aria-label={`Craft ${result?.name ?? recipe.id}`}
                      onClick={() => onCraftRecipe(recipe.id)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-sm voxel-btn-amber disabled:bg-stone-700 disabled:border-stone-800 disabled:text-stone-400 disabled:shadow-none shrink-0 cursor-pointer"
                    >
                      Craft
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ContainerShell>
  );
};

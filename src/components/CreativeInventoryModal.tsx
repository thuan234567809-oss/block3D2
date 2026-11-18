import React, { useMemo, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import {
  CREATIVE_CATEGORIES,
  CreativeCategoryId,
  filterCreativeItems,
} from '../data/creativeCatalog';
import { getItemIconDataUrl } from '../render/textures';
import { HudSnapshot } from '../types/game';
import { ContainerShell, MutateContainerFn } from './ContainerShell';

interface CreativeInventoryModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onMutateContainer: MutateContainerFn;
}

export const CreativeInventoryModal: React.FC<CreativeInventoryModalProps> = ({
  hud,
  onClose,
  onMutateContainer,
}) => {
  const [activeCategory, setActiveCategory] = useState<CreativeCategoryId>('building_blocks');
  const [searchQuery, setSearchQuery] = useState('');

  const items = useMemo(
    () => filterCreativeItems(activeCategory, searchQuery),
    [activeCategory, searchQuery],
  );

  const isSearching = searchQuery.trim().length > 0;

  return (
    <ContainerShell
      hud={hud}
      title="Creative Inventory"
      subtitle="Click to grab a full stack · Right-click for 1 · Shift+Click to send directly to Hotbar"
      maxWidthClass="max-w-5xl"
      onClose={onClose}
      onMutate={onMutateContainer}
    >
      {({ setHovered }) => (
        <div className="space-y-3">
          {/* Search & Trash Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blocks, tools, weapons, food..."
                aria-label="Search Creative Items"
                className="w-full pl-9 pr-8 py-1.5 text-xs voxel-inset rounded text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400"
              />
              {isSearching && (
                <button
                  type="button"
                  aria-label="Clear Search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={!hud.cursorItem}
              onClick={() => onMutateContainer((c) => c.clearCursor())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded voxel-btn-stone disabled:opacity-45 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Discard Held Stack</span>
            </button>
          </div>

          {/* 10 Category Tabs */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Creative Categories">
            {CREATIVE_CATEGORIES.map((cat) => {
              const selected = !isSearching && activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                    selected
                      ? 'voxel-btn-amber font-bold'
                      : 'voxel-btn-stone text-stone-300 font-medium'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Creative Item Grid */}
          <div className="voxel-inset rounded p-2.5 max-h-[240px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400">
                No items matching "{searchQuery.trim()}".
              </div>
            ) : (
              <div className="grid grid-cols-9 gap-1.5 w-fit">
                {items.map((def) => {
                  const previewSlot = {
                    itemId: def.id,
                    count: def.maxStack,
                    durability: def.durability,
                  };
                  return (
                    <button
                      key={def.id}
                      type="button"
                      aria-label={`Take ${def.name}`}
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseEnter={() => setHovered(previewSlot)}
                      onMouseLeave={() => setHovered(null)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const btn: 0 | 2 = e.button === 2 ? 2 : 0;
                        onMutateContainer((c, inv) =>
                          c.pickCreativeItem(def.id, btn, e.shiftKey, inv),
                        );
                      }}
                      className="relative w-11 h-11 rounded-sm voxel-slot flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={getItemIconDataUrl(def.id)}
                        alt={def.name}
                        draggable={false}
                        className="w-7 h-7 pixelated pointer-events-none"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </ContainerShell>
  );
};

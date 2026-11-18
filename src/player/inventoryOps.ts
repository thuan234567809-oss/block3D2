import { ITEMS } from '../data/items';
import { InventorySlot } from '../types/game';

export type SlotValidator = (slot: InventorySlot, idx: number) => boolean;

export function cloneSlot(slot: InventorySlot | null): InventorySlot | null {
  return slot ? { ...slot } : null;
}

export function getItemMaxStack(itemId: string): number {
  return ITEMS[itemId]?.maxStack ?? 64;
}

export function canStackTogether(a: InventorySlot | null, b: InventorySlot | null): boolean {
  if (!a || !b) return false;
  if (a.itemId !== b.itemId) return false;
  if (getItemMaxStack(a.itemId) <= 1) return false;
  return a.durability === undefined && b.durability === undefined;
}

export interface SlotClickResult {
  slots: (InventorySlot | null)[];
  cursor: InventorySlot | null;
  changed: boolean;
}

/**
 * Standard Minecraft Java Edition Left (0) and Right (2) click on an editable slot array.
 */
export function clickInventorySlot(
  slotsInput: (InventorySlot | null)[],
  idx: number,
  cursorInput: InventorySlot | null,
  button: 0 | 2,
  validator?: SlotValidator,
): SlotClickResult {
  const slots = slotsInput.map(cloneSlot);
  const current = slots[idx] ?? null;
  const cursor = cloneSlot(cursorInput);

  if (button === 0) {
    // Left-click: pick up, place, merge, or swap
    if (!cursor) {
      if (!current) return { slots, cursor: null, changed: false };
      slots[idx] = null;
      return { slots, cursor: current, changed: true };
    }

    if (validator && !validator(cursor, idx)) {
      return { slots, cursor, changed: false };
    }

    if (!current) {
      slots[idx] = cursor;
      return { slots, cursor: null, changed: true };
    }

    if (canStackTogether(current, cursor)) {
      const maxStack = getItemMaxStack(current.itemId);
      const space = maxStack - current.count;
      if (space <= 0) return { slots, cursor, changed: false };
      const take = Math.min(space, cursor.count);
      current.count += take;
      const remaining = cursor.count - take;
      return {
        slots,
        cursor: remaining > 0 ? { ...cursor, count: remaining } : null,
        changed: true,
      };
    }

    // Different items or unstackable -> swap
    slots[idx] = cursor;
    return { slots, cursor: current, changed: true };
  }

  // Right-click: split half or place 1 item
  if (!cursor) {
    if (!current) return { slots, cursor: null, changed: false };
    const take = Math.ceil(current.count / 2);
    const left = current.count - take;
    slots[idx] = left > 0 ? { ...current, count: left } : null;
    return {
      slots,
      cursor: { ...current, count: take },
      changed: true,
    };
  }

  if (validator && !validator(cursor, idx)) {
    return { slots, cursor, changed: false };
  }

  if (!current) {
    slots[idx] = { ...cursor, count: 1 };
    const rem = cursor.count - 1;
    return {
      slots,
      cursor: rem > 0 ? { ...cursor, count: rem } : null,
      changed: true,
    };
  }

  if (canStackTogether(current, cursor)) {
    const maxStack = getItemMaxStack(current.itemId);
    if (current.count >= maxStack) return { slots, cursor, changed: false };
    current.count += 1;
    const rem = cursor.count - 1;
    return {
      slots,
      cursor: rem > 0 ? { ...cursor, count: rem } : null,
      changed: true,
    };
  }

  // Different items -> swap on right-click too
  slots[idx] = cursor;
  return { slots, cursor: current, changed: true };
}

/**
 * Click an output-only slot (Crafting, Furnace, Anvil): picks up or stacks onto cursor.
 */
export function takeOutputToCursor(
  outputSlot: InventorySlot | null,
  cursorInput: InventorySlot | null,
): { taken: boolean; nextCursor: InventorySlot | null } {
  if (!outputSlot) return { taken: false, nextCursor: cursorInput };
  if (!cursorInput) {
    return { taken: true, nextCursor: cloneSlot(outputSlot) };
  }
  if (!canStackTogether(cursorInput, outputSlot)) {
    return { taken: false, nextCursor: cursorInput };
  }
  const maxStack = getItemMaxStack(cursorInput.itemId);
  if (cursorInput.count + outputSlot.count > maxStack) {
    return { taken: false, nextCursor: cursorInput };
  }
  return {
    taken: true,
    nextCursor: { ...cursorInput, count: cursorInput.count + outputSlot.count },
  };
}

/**
 * Drag distribution across multiple hovered slots from a pre-drag snapshot.
 * Left-drag (0) splits evenly across visited slots; Right-drag (2) drops 1 per slot.
 * Strictly conserves item counts.
 */
export function computeDragDistribution(
  baseSlots: (InventorySlot | null)[],
  baseCursor: InventorySlot | null,
  visitedIndices: number[],
  button: 0 | 2,
  validator?: SlotValidator,
): SlotClickResult {
  const slots = baseSlots.map(cloneSlot);
  if (!baseCursor || visitedIndices.length === 0) {
    return { slots, cursor: cloneSlot(baseCursor), changed: false };
  }

  // Deduplicate while preserving visit order, keeping only compatible empty or matching slots
  const uniqueValid: number[] = [];
  const seen = new Set<number>();
  for (const idx of visitedIndices) {
    if (seen.has(idx) || idx < 0 || idx >= slots.length) continue;
    seen.add(idx);
    if (validator && !validator(baseCursor, idx)) continue;
    const target = slots[idx];
    if (!target || (canStackTogether(target, baseCursor) && target.count < getItemMaxStack(baseCursor.itemId))) {
      uniqueValid.push(idx);
    }
  }

  if (uniqueValid.length === 0) {
    return { slots, cursor: cloneSlot(baseCursor), changed: false };
  }

  const maxStack = getItemMaxStack(baseCursor.itemId);
  let remaining = baseCursor.count;

  if (button === 0) {
    // Even split (if fewer items than slots, place 1 into the first N slots)
    const activeTargets = remaining >= uniqueValid.length ? uniqueValid : uniqueValid.slice(0, remaining);
    const perSlot = Math.max(1, Math.floor(remaining / activeTargets.length));
    for (const idx of activeTargets) {
      if (remaining <= 0) break;
      const cur = slots[idx];
      const room = cur ? maxStack - cur.count : maxStack;
      const add = Math.min(perSlot, room, remaining);
      if (add <= 0) continue;
      if (cur) {
        cur.count += add;
      } else {
        slots[idx] = { ...baseCursor, count: add };
      }
      remaining -= add;
    }
  } else {
    // Right-drag: 1 item per visited compatible slot
    for (const idx of uniqueValid) {
      if (remaining <= 0) break;
      const cur = slots[idx];
      const room = cur ? maxStack - cur.count : maxStack;
      if (room <= 0) continue;
      if (cur) {
        cur.count += 1;
      } else {
        slots[idx] = { ...baseCursor, count: 1 };
      }
      remaining -= 1;
    }
  }

  return {
    slots,
    cursor: remaining > 0 ? { ...baseCursor, count: remaining } : null,
    changed: remaining !== baseCursor.count,
  };
}

/**
 * Shift-click transfer from srcSlots[idx] into one or more destination arrays in priority order.
 */
export function shiftTransferSlot(
  srcSlots: (InventorySlot | null)[],
  idx: number,
  destGroups: { slots: (InventorySlot | null)[]; validator?: SlotValidator }[],
): boolean {
  const src = srcSlots[idx];
  if (!src) return false;
  const maxStack = getItemMaxStack(src.itemId);
  let remaining = src.count;

  // Pass 1: Merge into existing partial stacks
  if (maxStack > 1 && src.durability === undefined) {
    for (const group of destGroups) {
      for (let i = 0; i < group.slots.length && remaining > 0; i++) {
        const dst = group.slots[i];
        if (dst && canStackTogether(dst, src) && dst.count < maxStack) {
          if (group.validator && !group.validator(src, i)) continue;
          const take = Math.min(remaining, maxStack - dst.count);
          dst.count += take;
          remaining -= take;
        }
      }
    }
  }

  // Pass 2: Place into empty slots
  for (const group of destGroups) {
    for (let i = 0; i < group.slots.length && remaining > 0; i++) {
      if (!group.slots[i]) {
        if (group.validator && !group.validator(src, i)) continue;
        const take = Math.min(remaining, maxStack);
        group.slots[i] = { ...src, count: take };
        remaining -= take;
      }
    }
  }

  if (remaining === src.count) return false;
  srcSlots[idx] = remaining > 0 ? { ...src, count: remaining } : null;
  return true;
}

export function dropCursorOutside(
  cursor: InventorySlot | null,
  button: 0 | 2,
): { dropped: InventorySlot | null; nextCursor: InventorySlot | null } {
  if (!cursor) return { dropped: null, nextCursor: null };
  if (button === 0 || cursor.count <= 1) {
    return { dropped: cloneSlot(cursor), nextCursor: null };
  }
  return {
    dropped: { ...cursor, count: 1 },
    nextCursor: { ...cursor, count: cursor.count - 1 },
  };
}

import { WorldSaveData } from '../types/game';

const DB_NAME = 'blockworld_saves_v1';
const STORE_NAME = 'worlds';
const SLOT_KEY = 'primary_world';
const LS_FALLBACK_KEY = 'blockworld_save_fallback';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorldToDb(data: WorldSaveData): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, SLOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(data));
  }
}

function isValidSaveData(data: unknown): data is WorldSaveData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<WorldSaveData>;
  if (typeof d.seed !== 'number' || !d.player || typeof d.player.x !== 'number') return false;
  if (!Array.isArray(d.player.hotbar) || !Array.isArray(d.player.inventory) || !d.player.armorSlots) return false;
  return true;
}

export async function loadWorldFromDb(): Promise<WorldSaveData | null> {
  try {
    const db = await openDb();
    const res = await new Promise<WorldSaveData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SLOT_KEY);
      req.onsuccess = () => resolve((req.result as WorldSaveData) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (isValidSaveData(res)) return res;
  } catch {
    // ignore and try fallback
  }
  const raw = localStorage.getItem(LS_FALLBACK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValidSaveData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function hasSavedWorld(): Promise<boolean> {
  const data = await loadWorldFromDb();
  return data !== null;
}

export async function deleteSavedWorld(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SLOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
  localStorage.removeItem(LS_FALLBACK_KEY);
}

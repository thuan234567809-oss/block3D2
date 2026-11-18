import * as THREE from 'three';
import { shouldToggleFlightOnSpaceTap } from '../player/flightPhysics';
import { GamePhase } from '../types/game';

export interface InputCallbacks {
  getPhase: () => GamePhase;
  isInventoryOpen: () => boolean;
  getSensitivity: () => number;
  onToggleInventory: (force?: boolean) => void;
  onSetPhase: (phase: GamePhase) => void;
  onSelectSlot: (idx: number) => void;
  onDropItem: () => void;
  onToggleMute: () => void;
  onLeftDown: () => void;
  onLeftUp: () => void;
  onRightClick: () => void;
  onPointerLockChange: (locked: boolean) => void;
  onLookDelta: (dyaw: number, dpitch: number) => void;
  onWheelDelta: (dir: number) => void;
  onSpaceDoubleTap?: () => void;
}

export class InputController {
  public keys = new Set<string>();
  public jumpBuffered = false;
  public mouseLeft = false;
  public pointerLocked = false;
  private dom: HTMLElement;
  private cb: InputCallbacks;
  private lastClientX: number | null = null;
  private lastClientY: number | null = null;
  private lastSpaceTapMs = 0;

  constructor(domElement: HTMLElement, cb: InputCallbacks) {
    this.dom = domElement;
    this.cb = cb;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearHeld);
    document.addEventListener('visibilitychange', this.onVisibility);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    document.addEventListener('mousemove', this.onMouseMove);
    this.dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.dom.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  public requestLock(): void {
    try {
      const maybePromise = this.dom.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore in headless browser
    }
  }

  public clearHeld = (): void => {
    this.keys.clear();
    this.mouseLeft = false;
    this.lastClientX = null;
    this.lastClientY = null;
    this.lastSpaceTapMs = 0;
  };

  private onVisibility = (): void => {
    if (document.hidden) this.clearHeld();
  };

  private onPointerLock = (): void => {
    this.pointerLocked = document.pointerLockElement === this.dom;
    this.cb.onPointerLockChange(this.pointerLocked);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.cb.getPhase() !== GamePhase.Playing || this.cb.isInventoryOpen()) return;
    if (!this.pointerLocked && (e.buttons & 1) === 0 && (e.buttons & 2) === 0) return;
    const rawX =
      e.movementX !== 0
        ? e.movementX
        : this.lastClientX !== null
          ? e.clientX - this.lastClientX
          : 0;
    const rawY =
      e.movementY !== 0
        ? e.movementY
        : this.lastClientY !== null
          ? e.clientY - this.lastClientY
          : 0;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    if (Math.abs(rawX) > 250 || Math.abs(rawY) > 250) return;
    const sens = 0.0022 * this.cb.getSensitivity();
    this.cb.onLookDelta(-rawX * sens, -rawY * sens);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.cb.getPhase() !== GamePhase.Playing || this.cb.isInventoryOpen()) return;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    if (!this.pointerLocked) this.requestLock();
    if (e.button === 0) {
      this.mouseLeft = true;
      this.cb.onLeftDown();
    } else if (e.button === 2) {
      this.cb.onRightClick();
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.lastClientX = null;
    this.lastClientY = null;
    if (e.button === 0) {
      this.mouseLeft = false;
      this.cb.onLeftUp();
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.cb.getPhase() !== GamePhase.Playing || this.cb.isInventoryOpen()) return;
    if (e.deltaY > 0) this.cb.onWheelDelta(1);
    else if (e.deltaY < 0) this.cb.onWheelDelta(-1);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (e.code === 'Escape' && this.cb.getPhase() === GamePhase.Playing && this.cb.isInventoryOpen()) {
        e.preventDefault();
        e.target.blur();
        this.cb.onToggleInventory(false);
      }
      return;
    }
    const code = e.code;
    this.keys.add(code);
    const phase = this.cb.getPhase();

    if (phase === GamePhase.Playing) {
      if (code === 'Space') {
        this.jumpBuffered = true;
        if (!e.repeat && !this.cb.isInventoryOpen()) {
          const tap = shouldToggleFlightOnSpaceTap(this.lastSpaceTapMs, performance.now());
          this.lastSpaceTapMs = tap.nextLastTapMs;
          if (tap.toggled) this.cb.onSpaceDoubleTap?.();
        }
      }
      if (code === 'KeyE') {
        e.preventDefault();
        this.cb.onToggleInventory();
      } else if (code === 'Escape' || code === 'KeyP') {
        if (this.cb.isInventoryOpen()) this.cb.onToggleInventory(false);
        else this.cb.onSetPhase(GamePhase.Paused);
      } else if (code === 'KeyQ') {
        this.cb.onDropItem();
      } else if (code === 'KeyM') {
        this.cb.onToggleMute();
      } else if (code.startsWith('Digit')) {
        const num = parseInt(code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) this.cb.onSelectSlot(num - 1);
      }
    } else if (phase === GamePhase.Paused && (code === 'Escape' || code === 'KeyP')) {
      this.cb.onSetPhase(GamePhase.Playing);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  public applyLook(yaw: number, pitch: number, dyaw: number, dpitch: number): { yaw: number; pitch: number } {
    return {
      yaw: yaw + dyaw,
      pitch: THREE.MathUtils.clamp(pitch + dpitch, -Math.PI * 0.48, Math.PI * 0.48),
    };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearHeld);
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.dom.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.dom.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('wheel', this.onWheel);
  }
}

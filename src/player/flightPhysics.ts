import { isBlockFluid } from '../data/blocks';
import { BlockAccessor } from '../world/mesher';
import { aabbCollidesWorld, PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from './physics';
import { getPlayerEyeHeight, PhysicsState } from './playerTransform';

export interface FlightMoveIntent {
  forward: number; // -1..1
  strafe: number; // -1..1
  yaw: number;
  ascend: boolean;
  descend: boolean;
  sprint: boolean;
}

export const DOUBLE_TAP_WINDOW_MS = 300;
export const CREATIVE_FLIGHT_MIN_Y = 1.05;
export const CREATIVE_FLIGHT_MAX_Y = 192;

export function shouldToggleFlightOnSpaceTap(
  lastTapMs: number,
  nowMs: number,
  windowMs = DOUBLE_TAP_WINDOW_MS,
): { toggled: boolean; nextLastTapMs: number } {
  if (lastTapMs > 0 && nowMs - lastTapMs <= windowMs) {
    return { toggled: true, nextLastTapMs: 0 };
  }
  return { toggled: false, nextLastTapMs: nowMs };
}

/**
 * Camera-oriented 3D Creative Flight integrator with zero gravity,
 * horizontal + vertical acceleration damping, and clean AABB collision resolution
 * so player collider & world coordinates never desync or clip inside solid rock.
 */
export function stepCreativeFlight(
  state: PhysicsState,
  intent: FlightMoveIntent,
  dt: number,
  getBlock: BlockAccessor,
): void {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  if (clampedDt === 0) return;

  const feetBlock = getBlock(Math.floor(state.x), Math.floor(state.y + 0.2), Math.floor(state.z));
  const headBlock = getBlock(Math.floor(state.x), Math.floor(state.y + getPlayerEyeHeight(false)), Math.floor(state.z));
  state.inWater = isBlockFluid(feetBlock);
  state.headInWater = isBlockFluid(headBlock);

  const sinYaw = Math.sin(intent.yaw);
  const cosYaw = Math.cos(intent.yaw);
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let moveX = fwdX * intent.forward + rightX * intent.strafe;
  let moveZ = fwdZ * intent.forward + rightZ * intent.strafe;
  const hLen = Math.hypot(moveX, moveZ);
  if (hLen > 0.001) {
    moveX /= hLen;
    moveZ /= hLen;
  }

  const hSpeed = intent.sprint ? 17.5 : 10.2;
  const vSpeed = intent.sprint ? 11.5 : 7.8;

  const targetVx = moveX * hSpeed;
  const targetVz = moveZ * hSpeed;
  const verticalDir = (intent.ascend ? 1 : 0) - (intent.descend ? 1 : 0);
  const targetVy = verticalDir * vSpeed;

  const hAlpha = 1 - Math.exp(-12 * clampedDt);
  const vAlpha = 1 - Math.exp(-14 * clampedDt);
  state.vx += (targetVx - state.vx) * hAlpha;
  state.vz += (targetVz - state.vz) * hAlpha;
  state.vy += (targetVy - state.vy) * vAlpha;

  if (Math.abs(state.vx) < 0.01 && targetVx === 0) state.vx = 0;
  if (Math.abs(state.vz) < 0.01 && targetVz === 0) state.vz = 0;
  if (Math.abs(state.vy) < 0.01 && targetVy === 0) state.vy = 0;

  const maxDelta = Math.max(
    Math.abs(state.vx * clampedDt),
    Math.abs(state.vy * clampedDt),
    Math.abs(state.vz * clampedDt),
  );
  const subSteps = Math.max(1, Math.min(4, Math.ceil(maxDelta / 0.35)));
  const subDt = clampedDt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const nextX = state.x + state.vx * subDt;
    if (!aabbCollidesWorld(nextX, state.y, state.z, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock)) {
      state.x = nextX;
    } else {
      state.vx = 0;
    }

    const nextZ = state.z + state.vz * subDt;
    if (!aabbCollidesWorld(state.x, state.y, nextZ, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock)) {
      state.z = nextZ;
    } else {
      state.vz = 0;
    }

    const rawNextY = state.y + state.vy * subDt;
    const clampedNextY = Math.max(CREATIVE_FLIGHT_MIN_Y, Math.min(CREATIVE_FLIGHT_MAX_Y, rawNextY));
    if (!aabbCollidesWorld(state.x, clampedNextY, state.z, PLAYER_HALF_WIDTH, PLAYER_HEIGHT, getBlock)) {
      state.y = clampedNextY;
      if (clampedNextY !== rawNextY) state.vy = 0;
    } else {
      state.vy = 0;
    }
  }

  state.onGround = aabbCollidesWorld(state.x, state.y - 0.06, state.z, PLAYER_HALF_WIDTH, 0.06, getBlock);
  state.fallStartY = state.y;
}

import type { Settings } from './policy';
import { isForceOff } from './policy';
import { getSeed, SITES } from './mockSeed';
export { getSeed, SITES } from './mockSeed';
/* Boundary: S2-WB replaces this adapter with GET/PUT backend; real ASST_FORCE_OFF is server-only. */
export async function loadSettings(mode: string): Promise<Settings> {
  await new Promise(resolve => setTimeout(resolve, 200));
  if (mode === 'loadError') throw new Error('Mock API 暂时不可用，请重试');
  return getSeed(mode, isForceOff(import.meta.env.VITE_ASST_FORCE_OFF));
}

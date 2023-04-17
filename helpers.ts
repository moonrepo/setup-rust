import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
export const CARGO_HOME = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');

export function getPrimaryCacheKey(): string {
	return `setup-rustcargo-${process.platform}`;
}

export function getPathsToCache(): string[] {
	return [path.join(CARGO_HOME, 'registry')];
}

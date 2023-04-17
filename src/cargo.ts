/* eslint-disable node/no-unsupported-features/node-builtins */

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
export const CARGO_HOME = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');

export const CACHE_ENABLED = core.getBooleanInput('cache') || cache.isFeatureAvailable();

export function getPrimaryCacheKey(): string {
	return `setup-rustcargo-${process.platform}`;
}

export function getPathsToCache(): string[] {
	return [path.join(CARGO_HOME, 'registry')];
}

export async function cleanCargoRegistry() {
	core.info('Cleaning cache before saving');

	const registryDir = path.join(CARGO_HOME, 'registry');

	// .cargo/registry/src - Delete entirely
	await exec.exec('cargo', ['cache', '--autoclean']);

	// .cargo/registry/index - Delete .cache directories
	const globber = await glob.create(path.join(registryDir, 'index/**/.cache'));

	for await (const file of globber.globGenerator()) {
		core.debug(`Deleting ${file}`);
		await fs.promises.unlink(file);
	}

	// .cargo/registry/cache - Do nothing?
}

export async function saveCache() {
	if (!CACHE_ENABLED) {
		return;
	}

	const primaryKey = getPrimaryCacheKey();
	const cacheHitKey = core.getState('cache-hit-key');

	if (cacheHitKey === primaryKey) {
		core.info(`Cache hit occured on the key ${cacheHitKey}, not saving cache`);
		return;
	}

	await cleanCargoRegistry();

	core.info(`Saving cache with key ${primaryKey}`);

	await cache.saveCache(getPathsToCache(), primaryKey);
}

export async function restoreCache() {
	if (!CACHE_ENABLED) {
		return;
	}

	core.info('Attempting to restore cache');

	const primaryKey = await getPrimaryCacheKey();

	const cacheKey = await cache.restoreCache(getPathsToCache(), primaryKey, [
		`setup-rustcargo-${process.platform}`,
		'setup-rustcargo',
	]);

	if (cacheKey) {
		core.saveState('cache-hit-key', cacheKey);
		core.info(`Cache restored using key ${primaryKey}`);
	} else {
		core.warning(`Cache does not exist using key ${primaryKey}`);
	}

	core.setOutput('cache-key', cacheKey ?? primaryKey);
	core.setOutput('cache-hit', !!cacheKey);
}

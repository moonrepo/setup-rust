import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { CACHE_ENABLED, getPathsToCache, getPrimaryCacheKey } from './helpers';

async function saveCache() {
	if (!CACHE_ENABLED) {
		return;
	}

	const primaryKey = getPrimaryCacheKey();
	const cacheHitKey = core.getState('cache-hit-key');

	if (cacheHitKey === primaryKey) {
		core.info(`Cache hit occured on the key ${cacheHitKey}, not saving cache`);
		return;
	}

	core.info('Cleaning cache before saving');

	await exec.exec('cargo', ['cache', '--autoclean']);

	core.info(`Saving cache with key ${primaryKey}`);

	await cache.saveCache(getPathsToCache(), primaryKey);
}

async function run() {
	try {
		await saveCache();
	} catch (error: unknown) {
		core.setFailed((error as Error).message);
	}
}

void run();

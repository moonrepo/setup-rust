import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { getPathsToCache, getPrimaryCacheKey } from './helpers';

async function saveCache() {
	const enabled = core.getBooleanInput('cache');

	if (!cache.isFeatureAvailable() || !enabled) {
		return;
	}

	const primaryKey = getPrimaryCacheKey();
	const cacheHitKey = core.getState('cacheHitKey');

	if (cacheHitKey === primaryKey) {
		core.info(`Cache hit occured on the key ${cacheHitKey}, not saving cache`);
		return;
	}

	core.info('Cleaning cache before saving');

	await exec.exec('cargo', ['cache', '--autoclean']);

	core.info(`Saving cache with key ${primaryKey}`);

	await cache.saveCache(getPathsToCache(), primaryKey, {}, false);
}

async function run() {
	try {
		await saveCache();
	} catch (error: unknown) {
		core.setFailed((error as Error).message);
	}
}

void run();

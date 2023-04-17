import fs from 'fs';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { CARGO_HOME } from './helpers';

async function run() {
	const enabled = core.getBooleanInput('cache');

	if (!cache.isFeatureAvailable() || !enabled) {
		return;
	}

	if (!fs.existsSync(CARGO_HOME)) {
		core.warning(`~/.cargo does not exist, not saving cache`);
		return;
	}

	try {
		const primaryKey = 'v0-test';
		const cacheHitKey = core.getState('cacheHitKey');

		if (cacheHitKey === primaryKey) {
			core.info(`Cache hit occured on the key ${cacheHitKey}, not saving cache`);
			return;
		}

		core.info(`Saving cache with key ${primaryKey}`);

		await cache.saveCache([path.join(CARGO_HOME, 'registry')], primaryKey, {}, false);
	} catch (error: unknown) {
		core.setFailed((error as Error).message);
	}
}

void run();

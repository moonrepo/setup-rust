import * as core from '@actions/core';
import { saveCache } from './src/cargo';

async function run() {
	try {
		const base = core.getInput('cache-base');

		// Only save the cache for the following 2 scenarios:
		//	- If not using the base warmup strategy.
		//	- If using the base warmup strategy, and the current ref matches.
		if (!base || (base && !!(process.env.GITHUB_REF_NAME ?? '').match(base))) {
			await saveCache();
		}
	} catch (error: unknown) {
		core.setFailed((error as Error).message);
	}
}

void run();

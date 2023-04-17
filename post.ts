import * as core from '@actions/core';
import { saveCache } from './src/cargo';

async function run() {
	try {
		await saveCache();
	} catch (error: unknown) {
		core.setFailed((error as Error).message);
	}
}

void run();

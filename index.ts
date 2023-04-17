import path from 'path';
import * as core from '@actions/core';
import { CARGO_HOME, installBins, restoreCache } from './src/cargo';
import { installToolchain } from './src/rust';

async function run() {
	core.info('Setting cargo environment variables');

	core.exportVariable('CARGO_INCREMENTAL', '0');
	core.exportVariable('CARGO_TERM_COLOR', 'always');

	core.info('Adding ~/.cargo/bin to PATH');

	core.addPath(path.join(CARGO_HOME, 'bin'));

	try {
		await installToolchain();
		await installBins();

		// Restore cache after the toolchain has been installed,
		// as we use the rust version and commit hashes in the cache key!
		await restoreCache();
	} catch (error: unknown) {
		core.setFailed((error as Error).message);

		throw error;
	}
}

void run();

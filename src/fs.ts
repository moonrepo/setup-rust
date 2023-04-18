import * as core from '@actions/core';
import * as io from '@actions/io';

export async function rmrf(dir: string) {
	core.debug(`Deleting ${dir}`);

	try {
		await io.rmRF(dir);
	} catch (error: unknown) {
		core.warning(`Failed to delete ${dir}: ${error}`);
	}
}

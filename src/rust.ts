import * as core from '@actions/core';
import * as exec from '@actions/exec';

export async function extractRustVersion(toolchain: string) {
	let out = '';

	await exec.exec('rustc', [`+${toolchain}`, '--version', '--verbose'], {
		listeners: {
			stdout(data: Buffer) {
				out += data.toString();
			},
		},
	});

	out.split('\n').forEach((line) => {
		let key = '';

		if (line.startsWith('commit-hash')) {
			key = 'rust-hash';
		} else if (line.startsWith('release')) {
			key = 'rust-version';
		} else {
			return;
		}

		const value = line.split(':')[1].trim();

		core.saveState(key, value);
		core.setOutput(key, value);
	});
}

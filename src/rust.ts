/* eslint-disable import/no-mutable-exports */

import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import TOML from '@ltd/j-toml';

interface Toolchain {
	channel: string;
	components: string[];
	targets: string[];
	profile: string;
}

interface ToolchainConfig {
	toolchain: Partial<Toolchain>;
}

const DEFAULT_TOOLCHAIN: Toolchain = {
	channel: 'stable',
	components: [],
	profile: 'minimal',
	targets: [],
};

export let RUST_VERSION = core.getState('rust-version');
export let RUST_HASH = core.getState('rust-hash');

export async function extractRustVersion(toolchain: string) {
	let out = '';

	await exec.exec('rustc', [`+${toolchain}`, '--version', '--verbose'], {
		listeners: {
			stdout(data: Buffer) {
				out += data.toString();
			},
		},
	});

	const extract = (key: string, line: string) => {
		const value = line.split(':')[1].trim();

		core.setOutput(key, value);
		core.saveState(key, value);

		return value;
	};

	out.split('\n').forEach((line) => {
		if (line.startsWith('commit-hash')) {
			RUST_HASH = extract('rust-hash', line);

			// version
		} else if (line.startsWith('release')) {
			RUST_VERSION = extract('rust-version', line);
		}
	});
}

export function parseConfig(configPath: string): Partial<Toolchain> {
	const contents = fs.readFileSync(configPath, 'utf8').trim();

	if (!contents.includes('[toolchain]')) {
		core.debug('No [toolchain] section found, assuming legacy format');

		return { channel: contents };
	}

	const config = TOML.parse(contents) as unknown as ToolchainConfig;

	if (config.toolchain) {
		if (core.getBooleanInput('inherit-toolchain')) {
			core.debug('Inheriting entire [toolchain] section');

			return { ...config.toolchain };
		}

		if (config.toolchain.channel) {
			core.debug('Found channel in [toolchain] section');

			return { channel: config.toolchain.channel };
		}
	}

	core.debug('No channel found in [toolchain] section');

	return {};
}

// https://rust-lang.github.io/rustup/overrides.html
export function detectToolchain(): Toolchain {
	core.info('Detecting toolchain');

	const toolchain = { ...DEFAULT_TOOLCHAIN };

	if (process.env.RUSTUP_TOOLCHAIN) {
		core.info('Using toolchain from RUSTUP_TOOLCHAIN environment variable');

		Object.assign(toolchain, {
			channel: process.env.RUSTUP_TOOLCHAIN,
		});
	} else {
		core.info('Loading rust-toolchain.toml or rust-toolchain file');

		for (const configName of ['rust-toolchain.toml', 'rust-toolchain']) {
			const configPath = path.join(process.cwd(), configName);

			if (fs.existsSync(configPath)) {
				core.debug(`Found ${configName}, parsing TOML`);

				Object.assign(toolchain, parseConfig(configPath));
				break;
			}
		}
	}

	core.info('Inheriting toolchain settings from inputs');

	(Object.keys(DEFAULT_TOOLCHAIN) as (keyof typeof DEFAULT_TOOLCHAIN)[]).forEach((key) => {
		const input = core.getInput(key);

		if (input) {
			core.debug(`Found input for ${key}: ${input}`);

			if (key === 'components' || key === 'targets') {
				input.split(',').forEach((part) => {
					toolchain[key].push(part.trim());
				});
			} else {
				toolchain[key] = input;
			}
		}
	});

	return toolchain;
}

export async function installToolchain() {
	const toolchain = detectToolchain();

	core.info('Installing toolchain with rustup');

	const args = ['toolchain', 'install', toolchain.channel, '--profile', toolchain.profile];

	toolchain.targets.forEach((target) => {
		args.push('--target', target);
	});

	toolchain.components.forEach((component) => {
		args.push('--component', component);
	});

	if (toolchain.channel === 'nightly' && toolchain.components.length > 0) {
		args.push('--allow-downgrade');
	}

	args.push('--no-self-update');

	await exec.exec('rustup', args);
	await exec.exec('rustup', ['default', toolchain.channel]);

	core.info('Logging installed toolchain versions');

	await extractRustVersion(toolchain.channel);
}

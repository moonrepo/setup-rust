import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import TOML from '@ltd/j-toml';
import { CARGO_HOME } from './helpers';

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

function parseConfig(configPath: string): Partial<Toolchain> {
	const contents = fs.readFileSync(configPath, 'utf8').trim();

	if (!contents.includes('[toolchain]')) {
		core.debug('No [toolchain] section found, assuming legacy format');

		return { channel: contents };
	}

	const config = TOML.parse(contents) as unknown as ToolchainConfig;

	if (config.toolchain.channel) {
		core.debug('Found channel in [toolchain] section');

		return { channel: config.toolchain.channel };
	}

	core.debug('No channel found in [toolchain] section');

	return {};
}

// https://rust-lang.github.io/rustup/overrides.html
function detectToolchain(): Toolchain {
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

async function installToolchain(toolchain: Toolchain) {
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

	await exec.exec('rustc', [`+${toolchain.channel}`, '--version', '--verbose']);
}

async function downloadAndInstallBinstall(binDir: string) {
	core.info('cargo-binstall does not exist, attempting to install');

	let arch;
	let file;

	switch (process.arch) {
		case 'x64':
			arch = 'x86_64';
			break;
		case 'arm64':
			arch = 'aarch64';
			break;
		default:
			throw new Error(`Unsupported architecture: ${process.arch}`);
	}

	switch (process.platform) {
		case 'linux':
			file = `${arch}-unknown-linux-gnu.tgz`;
			break;
		case 'darwin':
			file = `${arch}-apple-darwin.zip`;
			break;
		case 'win32':
			file = `${arch}-pc-windows-msvc.zip`;
			break;
		default:
			throw new Error(`Unsupported platform: ${process.platform}`);
	}

	const url = `https://github.com/cargo-bins/cargo-binstall/releases/latest/download/cargo-binstall-${file}`;
	const dlPath = await tc.downloadTool(url);

	if (url.endsWith('.zip')) {
		await tc.extractZip(dlPath, binDir);
	} else if (url.endsWith('.tgz')) {
		await tc.extractTar(dlPath, binDir);
	}
}

async function installBins() {
	const bins = core
		.getInput('bins')
		.split(',')
		.map((bin) => bin.trim())
		.filter(Boolean)
		.map((bin) => (bin.startsWith('cargo-') ? bin : `cargo-${bin}`));

	if (bins.length === 0) {
		return;
	}

	core.info('Installing additional binaries');

	const binDir = path.join(CARGO_HOME, 'bin');

	if (!fs.existsSync(path.join(binDir, 'cargo-binstall'))) {
		await downloadAndInstallBinstall(binDir);
	}

	await exec.exec('cargo', ['binstall', '--no-confirm', '--log-level', 'info', ...bins]);
}

async function run() {
	core.info('Setting cargo environment variables');

	// Disable incremental compilation
	core.exportVariable('CARGO_INCREMENTAL', '0');

	// Always enable colored output
	core.exportVariable('CARGO_TERM_COLOR', 'always');

	try {
		await installToolchain(detectToolchain());
		await installBins();
	} catch (error: unknown) {
		core.setFailed((error as Error).message);

		throw error;
	}

	core.info('Adding ~/.cargo/bin to PATH');

	core.addPath(path.join(CARGO_HOME, 'bin'));
}

void run();

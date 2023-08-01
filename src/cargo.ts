import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tc from '@actions/tool-cache';
import { rmrf } from './fs';
import { RUST_HASH, RUST_VERSION } from './rust';

export const CARGO_HOME = process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo');

export const WORKSPACE_ROOT = process.env.GITHUB_WORKSPACE ?? process.cwd();

export const CACHE_ENABLED = core.getBooleanInput('cache') && cache.isFeatureAvailable();

export async function downloadAndInstallBinstall(binDir: string) {
	core.info('cargo-binstall does not exist, attempting to install');

	let arch;
	let file;

	switch (process.arch) {
		case 'x64':
			arch = 'x86_64';
			break;
		case 'arm':
			arch = 'armv7';
			break;
		case 'arm64':
			arch = 'aarch64';
			break;
		default:
			throw new Error(`Unsupported architecture: ${process.arch}`);
	}

	switch (process.platform) {
		case 'linux': {
			const { family } = await import('detect-libc');
			let lib = 'gnu';

			if ((await family()) === 'musl') {
				lib = 'musl';
			}

			if (process.arch === 'arm') {
				lib += 'eabihf';
			}

			file = `${arch}-unknown-linux-${lib}.tgz`;
			break;
		}
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

export async function installBins() {
	const bins = core
		.getInput('bins')
		.split(',')
		.map((bin) => bin.trim())
		.filter(Boolean);

	if (CACHE_ENABLED) {
		bins.push('cargo-cache');
	}

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

export function getCacheTarget(): string {
	return core.getInput('cache-target') || 'debug';
}

export function getCachePaths(): string[] {
	return [
		// ~/.cargo/registry
		path.join(CARGO_HOME, 'registry'),
		// /workspace/target/debug
		path.join(WORKSPACE_ROOT, 'target', getCacheTarget()),
	];
}

export function getCachePrefixes(): string[] {
	return [`setup-rustcargo-v1-${process.platform}`, 'setup-rustcargo-v1'];
}

export async function getPrimaryCacheKey() {
	const hasher = crypto.createHash('sha1');

	core.info('Generating cache key');

	core.debug(`Hashing Rust version = ${RUST_VERSION}`);
	hasher.update(RUST_VERSION);

	core.debug(`Hashing Rust commit hash = ${RUST_HASH}`);
	hasher.update(RUST_HASH);

	const lockHash = await glob.hashFiles('Cargo.lock');

	core.debug(`Hashing Cargo.lock = ${lockHash}`);
	hasher.update(lockHash);

	const cacheTarget = getCacheTarget();

	core.debug(`Hashing target profile = ${cacheTarget}`);
	hasher.update(cacheTarget);

	const job = process.env.GITHUB_JOB;

	if (job) {
		core.debug(`Hashing GITHUB_JOB = ${job}`);
		hasher.update(job);
	}

	return `${getCachePrefixes()[0]}-${hasher.digest('hex')}`;
}

export async function cleanCargoRegistry() {
	core.info('Cleaning ~/.cargo before saving');

	const registryDir = path.join(CARGO_HOME, 'registry');

	// .cargo/registry/src - Delete entirely
	await exec.exec('cargo', ['cache', '--autoclean']);

	// .cargo/registry/index - Delete .cache directories
	const indexDir = path.join(registryDir, 'index');

	if (fs.existsSync(indexDir)) {
		await Promise.all(
			fs.readdirSync(indexDir).map(async (index) => {
				if (fs.existsSync(path.join(indexDir, index, '.git'))) {
					await rmrf(path.join(indexDir, index, '.cache'));
				}
			}),
		);
	}

	// .cargo/registry/cache - Do nothing?
}

// https://doc.rust-lang.org/cargo/guide/build-cache.html
export async function cleanTargetProfile() {
	const targetProfile = getCacheTarget();

	core.info(`Cleaning target/${targetProfile} before saving`);

	const targetDir = path.join(WORKSPACE_ROOT, 'target', targetProfile);

	// target/*/{examples,incremental} - Not required in CI
	core.info('Removing examples and incremental directories');

	await Promise.all(
		['examples', 'incremental'].map(async (dirName) => {
			const dir = path.join(targetDir, dirName);

			if (fs.existsSync(dir)) {
				await rmrf(dir);
			}
		}),
	);

	// target/**/*.d - Not required in CI?
	core.info('Removing dep-info files (*.d)');

	const globber = await glob.create(path.join(targetDir, '**/*.d'));
	const files = await globber.glob();

	await Promise.all(files.map(rmrf));
}

export async function saveCache() {
	if (!CACHE_ENABLED) {
		return;
	}

	const primaryKey = await getPrimaryCacheKey();
	const cacheHitKey = core.getState('cache-hit-key');

	if (cacheHitKey === primaryKey) {
		core.info(`Cache hit occured on the key ${cacheHitKey}, not saving cache`);
		return;
	}

	await cleanCargoRegistry();
	await cleanTargetProfile();

	core.info(`Saving cache with key ${primaryKey}`);

	await cache.saveCache(getCachePaths(), primaryKey);
}

export async function restoreCache() {
	if (!CACHE_ENABLED) {
		return;
	}

	core.info('Attempting to restore cache');

	const primaryKey = await getPrimaryCacheKey();
	const cacheKey = await cache.restoreCache(getCachePaths(), primaryKey, getCachePrefixes());

	if (cacheKey) {
		core.saveState('cache-hit-key', cacheKey);
		core.info(`Cache restored using key ${primaryKey}`);
	} else {
		core.info(`Cache does not exist using key ${primaryKey}`);
	}

	core.setOutput('cache-key', cacheKey ?? primaryKey);
	core.setOutput('cache-hit', !!cacheKey);
}

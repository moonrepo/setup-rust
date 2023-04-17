import crypto from 'crypto';
import os from 'os';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as io from '@actions/io';

export const CARGO_HOME = process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo');

export const CACHE_ENABLED = core.getBooleanInput('cache') || cache.isFeatureAvailable();

let CACHE_KEY = '';

export async function getPrimaryCacheKey() {
	if (CACHE_KEY) {
		return CACHE_KEY;
	}

	const hasher = crypto.createHash('sha1');

	core.info('Generating cache key');

	const rustVersion = core.getState('rust-version');

	core.debug(`Hashing Rust version = ${rustVersion}`);
	hasher.update(rustVersion);

	const rustHash = core.getState('rust-hash');

	core.debug(`Hashing Rust commit hash = ${rustHash}`);
	hasher.update(rustHash);

	const lockHash = await glob.hashFiles('Cargo.lock');

	core.debug(`Hashing Cargo.lock = ${lockHash}`);
	hasher.update(lockHash);

	const job = process.env.GITHUB_JOB;

	if (job) {
		core.debug(`Hashing GITHUB_JOB = ${job}`);
		hasher.update(job);
	}

	// eslint-disable-next-line require-atomic-updates
	CACHE_KEY = `setup-rustcargo-${process.platform}-${hasher.digest('hex')}`;

	return CACHE_KEY;
}

export function getPathsToCache(): string[] {
	return [
		// ~/.cargo/registry
		path.join(CARGO_HOME, 'registry'),
		// /workspace/target/debug
		path.join(process.env.GITHUB_WORKSPACE ?? process.cwd(), 'target/debug'),
	];
}

export async function cleanCargoRegistry() {
	core.info('Cleaning cache before saving');

	const registryDir = path.join(CARGO_HOME, 'registry');

	// .cargo/registry/src - Delete entirely
	await exec.exec('cargo', ['cache', '--autoclean']);

	// .cargo/registry/index - Delete .cache directories
	const globber = await glob.create(path.join(registryDir, 'index/**/.cache'));

	for await (const file of globber.globGenerator()) {
		core.debug(`Deleting ${file}`);
		await io.rmRF(file);
	}

	// .cargo/registry/cache - Do nothing?
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

	core.info(`Saving cache with key ${primaryKey}`);

	await cache.saveCache(getPathsToCache(), primaryKey);
}

export async function restoreCache() {
	if (!CACHE_ENABLED) {
		return;
	}

	core.info('Attempting to restore cache');

	const primaryKey = await getPrimaryCacheKey();

	const cacheKey = await cache.restoreCache(getPathsToCache(), primaryKey, [
		`setup-rustcargo-${process.platform}`,
		'setup-rustcargo',
	]);

	if (cacheKey) {
		core.saveState('cache-hit-key', cacheKey);
		core.info(`Cache restored using key ${primaryKey}`);
	} else {
		core.warning(`Cache does not exist using key ${primaryKey}`);
	}

	core.setOutput('cache-key', cacheKey ?? primaryKey);
	core.setOutput('cache-hit', !!cacheKey);
}

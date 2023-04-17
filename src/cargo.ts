import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as io from '@actions/io';
import { RUST_HASH, RUST_VERSION } from './rust';

export const CARGO_HOME = process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo');

export const CACHE_ENABLED = core.getBooleanInput('cache') || cache.isFeatureAvailable();

export function getCachePaths(): string[] {
	return [
		// ~/.cargo/registry
		path.join(CARGO_HOME, 'registry'),
		// /workspace/target/debug
		path.join(process.env.GITHUB_WORKSPACE ?? process.cwd(), 'target/debug'),
	];
}

export function getCachePrefixes(): string[] {
	return [`setup-rustcargo-${process.platform}`, 'setup-rustcargo'];
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

	const job = process.env.GITHUB_JOB;

	if (job) {
		core.debug(`Hashing GITHUB_JOB = ${job}`);
		hasher.update(job);
	}

	return `${getCachePrefixes()[0]}-${hasher.digest('hex')}`;
}

export async function cleanCargoRegistry() {
	core.info('Cleaning cache before saving');

	const registryDir = path.join(CARGO_HOME, 'registry');

	// .cargo/registry/src - Delete entirely
	await exec.exec('cargo', ['cache', '--autoclean']);

	// .cargo/registry/index - Delete .cache directories
	const indexDir = path.join(registryDir, 'index');

	for (const index of fs.readdirSync(indexDir)) {
		if (fs.existsSync(path.join(indexDir, index, '.git'))) {
			const dir = path.join(indexDir, index, '.cache');

			core.debug(`Deleting ${dir}`);

			try {
				// eslint-disable-next-line no-await-in-loop
				await io.rmRF(dir);
			} catch (error: unknown) {
				core.warning(`Failed to delete ${dir}: ${error}`);
			}
		}
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
		core.warning(`Cache does not exist using key ${primaryKey}`);
	}

	core.setOutput('cache-key', cacheKey ?? primaryKey);
	core.setOutput('cache-hit', !!cacheKey);
}

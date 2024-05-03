import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { RUST_HASH, RUST_VERSION } from './rust';

export const CARGO_HOME = process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo');

export const WORKSPACE_ROOT = process.env.GITHUB_WORKSPACE ?? process.cwd();

export function isCacheEnabled(): boolean {
	return core.getBooleanInput('cache') && cache.isFeatureAvailable();
}

export function getCacheTarget(): string {
	return core.getInput('cache-target') || 'debug';
}

export function getTargetPaths(): string[] {
	const profile = getCacheTarget();
	const dirs = core.getInput('target-dirs', { required: true }).split(',');

	return dirs
		.map((dir) => dir.trim())
		.filter(Boolean)
		.map((dir) => path.join(WORKSPACE_ROOT, dir, profile));
}

export function getCachePaths(): string[] {
	return [
		// ~/.cargo/registry
		path.join(CARGO_HOME, 'registry'),
		// /workspace/target/debug
		...getTargetPaths(),
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

	const cacheTarget = getCacheTarget();

	core.debug(`Hashing target profile = ${cacheTarget}`);
	hasher.update(cacheTarget);

	// When warming up, loosen the cache key to allow for more cache hits
	if (core.getInput('cache-base')) {
		core.debug('Using warmup strategy, not hashing Cargo.lock, GITHUB_WORKFLOW, or GITHUB_JOB');
		hasher.update('warmup');

		const baseRef = process.env.GITHUB_BASE_REF ?? '';

		if (
			baseRef === 'master' ||
			baseRef === 'main' ||
			baseRef === 'trunk' ||
			baseRef.startsWith('develop') ||
			baseRef.startsWith('release')
		) {
			core.debug(`Hashing GITHUB_BASE_REF = ${baseRef}`);
			hasher.update(baseRef);
		}
	}

	// Otherwise, these add far too much granularity to the cache key
	else {
		const lockHash = await glob.hashFiles('Cargo.lock');

		core.debug(`Hashing Cargo.lock = ${lockHash}`);
		hasher.update(lockHash);

		const workflow = process.env.GITHUB_WORKFLOW;

		if (workflow) {
			core.debug(`Hashing GITHUB_WORKFLOW = ${workflow}`);
			hasher.update(workflow);
		}

		const job = process.env.GITHUB_JOB;

		if (job) {
			core.debug(`Hashing GITHUB_JOB = ${job}`);
			hasher.update(job);
		}
	}

	return `${getCachePrefixes()[0]}-${hasher.digest('hex')}`;
}

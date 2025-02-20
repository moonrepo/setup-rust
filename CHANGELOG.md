# 1.2.2

- Updated dependencies.

# 1.2.1

- Pinned the `cargo-binstall` version to v1.8 to work around the 404 errors in CI.
- Added support for the `CARGO_BINSTALL_VERSION` environment variable.

# 1.2.0

- Added a `target-dirs` input, allowing the target folders to be specified. Can now cache multiple
  target folders.
- Updated to skip caching a directory if it does not exist, instead of failing.
- Updated dependencies.

# 1.1.0

- Added a `cache-base` input. When provided, will only save cache on this branch/ref, but will
  restore cache on all branches/refs.
- Updated dependencies.

# 1.0.3

- Include `GITHUB_WORKFLOW` in cache key.
- Updated dependencies.

# 1.0.2

- Switch to Node.js v20.

# 1.0.1

- Fixed an issue where a module was missing from the build.

# 1.0.0

- Will now install `rustup` if it does not exist in the environment.
- Added musl support to `cargo-binstall`.

# 0.6.0

- Breaking: Cargo `bins` must provide the `cargo-` crate prefix manually. This change allows
  non-crate globals to be installed.
- Added a `cache-target` input, to customize which target profile is cached. Defaults to `debug`.

# 0.5.0

- Added `inherit-toolchain` input to inherit all settings from `rust-toolchain.toml`, and not just
  `channel`.

# 0.1.0

- Initial release.

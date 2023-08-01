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

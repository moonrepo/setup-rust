# 0.6.0

- Breaking: Cargo `bins` must provide the `cargo-` crate prefix manually. This change allows
  non-crate globals to be installed.

# 0.5.0

- Added `inherit-toolchain` input to inherit all settings from `rust-toolchain.toml`, and not just
  `channel`.

# 0.1.0

- Initial release.

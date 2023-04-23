# Setup Rust and Cargo

A GitHub action for setting up Rust and Cargo.

```yaml
jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      # ...
      - uses: moonrepo/setup-rust@v0
      - run: cargo test
```

## Configuring the Rust toolchain

This action will automatically install the appropriate toolchain with `rustup` by inspecting the
`RUSTUP_TOOLCHAIN` environment variable or the `rust-toolchain.toml` (preferred) or `rust-toolchain`
configuration files. To specify the location of the toolchain configuration files you can use `rust-toolchain-file` option. If no toolchain found, will default to `stable`.

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.68.0"
```

> When loading a configuration file, only the `channel` field is used, while the other fields are
> ignored. We chose this approach, as those other fields are typically for develop/release
> workflows, but not for CI, which requires a minimal/granular setup.

The toolchain/channel can also be explicitly configured with the `toolchain` input, which takes
highest precedence.

```yaml
- uses: moonrepo/setup-rust@v0
  with:
    toolchain: '1.65.0'
```

### Profile and components

Furthermore, this action supports rustup profiles and components, which can be configured with the
`profile` and `components` inputs respectively. When not defined, profile defaults to `minimal`.

```yaml
- uses: moonrepo/setup-rust@v0
  with:
    profile: complete
```

When using components, the input requires a comma separated list of component names.

```yaml
- uses: moonrepo/setup-rust@v0
  with:
    components: clippy
- run: cargo clippy --workspace
```

## Installing Cargo binaries

If you require `cargo-make`, `cargo-nextest`, or other global binaries, this action supports
installing Cargo binaries through the `bins` input, which requires a comma-separated list of crate
names (`cargo-` prefix optional).

```yaml
- uses: moonrepo/setup-rust@v0
  with:
    bins: nextest, cargo-insta@1.28.0
```

> Binaries are installed with [`cargo-binstall`](https://crates.io/crates/cargo-binstall) under the
> hood.

## Caching in CI

By default this action will cache the `~/.cargo/registry` and `/target/debug` directories to improve
CI times. To disable caching, set the `cache` input to `false`.

```yaml
- uses: moonrepo/setup-rust@v0
  with:
    cache: false
```

The following optimizations and considerations are taken into account when caching:

- `~/.cargo`
  - The `/bin` directory is not cached as we manage binary installation in this action via the
    `bins` input.
  - The `/git` directory is not cached as it's not necessary for CI. When required by Cargo or a
    crate, a checkout will be performed on-demand.
  - The `/registry` directory is _cleaned_ before saving the cache. This includes removing `src`,
    `.cache`, and any other unnecessary files.
- `/target/debug`
  - Only the `debug` profile is cached, as this profile is typically used for formatting, linting,
    and testing.
  - The `/examples` and `/incremental` directories are not cached as they are not necessary for CI.
  - All dep-info (`*.d`) files are removed, as they're meant for build systems and signaling
    re-executions.

The following sources are hashed for the generated cache key: `$GITHUB_JOB`, `Cargo.lock`, Rust
version, Rust commit hash, and OS.

## Compared to

### `actions-rs/*`

The "official" actions have served their purpose, but after 3 years of no updates, severe lack of
maintenance, and being full of deprecation warnings, it was time to create something new.

Outside of being evergreen, this action also supports the following features:

- Automatically caches.
- Installs Cargo bins.
- Assumes `rustup`, `cargo`, and other commands are available globally. This allows you to use them
  directly in a `run` command, without having to use `actions-rs/cargo`.

However, this action _does not_:

- Install `rustup` if it does not exist, while `actions-rs` will. This is typically fine if using
  GitHub provided runners as all Rust tooling comes pre-installed.

### `dtolnay/rust-toolchain`

This action is very similar to `dtolnay/rust-toolchain`, which was a great implementation reference,
but this action also supports the following features:

- Extracts the toolchain/channel from `rust-toolchain.toml` and `rust-toolchain` configuration
  files.
- Automatically caches.
- Installs Cargo bins.

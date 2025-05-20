# Setup Rust and Cargo

A one-stop-shop GitHub action for setting up Rust and Cargo. Will automatically setup the Rust
toolchain with `rustup`, cache the `~/.cargo/registry` and `/target/debug` directories, and install
Cargo binaries (when applicable).

```yaml
jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      # ...
      - uses: moonrepo/setup-rust@v1
      - run: cargo test
```

## Inputs

The following inputs are available for the action, and can be passed via `with`. All inputs are
optional.

- `bins` - Comma-separated list of global binaries to install into Cargo.
- `cache` - Toggle caching of directories. Defaults to `true`.
- `cache-base` - Base branch/ref to save a warmup cache on. Other branches/refs will restore from
  this base.
- `cache-target` - Name of the target profile to cache. Defaults to `debug`.
- `channel` - Toolchain specification/channel to explicitly install.
- `components` - Comma-separated list of additional components to install.
- `inherit-toolchain` - Inherit all toolchain settings from the `rust-toolchain.toml` file. Defaults
  to `false`.
- `targets` - Comma-separated list of additional targets to install.
- `target-dirs` - Comma-separated list of target folder paths, relative from the repository root.
  Defaults to `target`.
- `profile` - Profile to install. Defaults to `minimal`.

## Configuring the Rust toolchain

This action will automatically install the appropriate toolchain with `rustup` by inspecting the
`RUSTUP_TOOLCHAIN` environment variable or the `rust-toolchain.toml` (preferred) or `rust-toolchain`
configuration files. If no toolchain found, will default to `stable`.

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.68.0"
```

> When loading a configuration file, only the `channel` field is used, while the other fields are
> ignored. We chose this approach, as those other fields are typically for develop/release
> workflows, but not for CI, which requires a minimal/granular setup. However, this can be
> overwritten with the `inherit-toolchain` input.

The toolchain/channel can also be explicitly configured with the `channel` input, which takes
highest precedence.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    channel: '1.65.0'
```

### Profile, components, and targets

Furthermore, this action supports rustup profiles, components, and targets, which can be configured
with the `profile`, `components`, and `targets` inputs respectively. When not defined, profile
defaults to `minimal`.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    profile: complete
```

When using components, the input requires a comma separated list of component names.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    components: clippy
- run: cargo clippy --workspace
```

When using targets, the input requires a comma separated list of target triples.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    targets: 'x86_64-pc-windows-msvc,x86_64-pc-windows-gnu'
```

## Installing Cargo binaries

If you require `cargo-make`, `cargo-nextest`, or other global binaries, this action supports
installing Cargo binaries through the `bins` input, which requires a comma-separated list of crate
names.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    bins: cargo-nextest, cargo-insta@1.28.0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> Binaries are installed with [`cargo-binstall`](https://crates.io/crates/cargo-binstall) under the
> hood. We suggest setting `GITHUB_TOKEN` to avoid rate limiting.

## Caching in CI

By default this action will cache the `~/.cargo/registry` and `/target/debug` directories to improve
CI times. To disable caching, set the `cache` input to `false`. Furthermore, the target profile can
be changed with the `cache-target` input, which defaults to `debug`.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    cache: false
    cache-target: release
```

The following optimizations and considerations are taken into account when caching:

- `~/.cargo`
  - The `/bin` directory is not cached as we manage binary installation in this action via the
    `bins` input.
  - The `/git` directory is not cached as it's not necessary for CI. When required by Cargo or a
    crate, a checkout will be performed on-demand.
  - The `/registry` directory is _cleaned_ before saving the cache. This includes removing `src`,
    `.cache`, and any other unnecessary files.
- `/target`
  - Only the `/debug` profile is cached, as this profile is typically used for formatting, linting,
    and testing. This can be changed with the `cache-target` input.
  - The `/examples` and `/incremental` sub-directories are not cached as they are not necessary for
    CI.
  - All dep-info (`*.d`) files are removed, as they're meant for build systems and signaling
    re-executions.

> The following sources are hashed for the generated cache key: `$GITHUB_JOB`, `Cargo.lock`, Rust
> version, Rust commit hash, and OS.

### Warmup strategy

Another strategy that we support is called a warmup cache, where a base branch/ref is used to
generate and save the cache (like master), and all other branches/refs will _only_ restore this
cache (and not save).

This can be enabled with the `cache-base` input, which requires a branch/ref name. This input also
supports regex.

```yaml
- uses: moonrepo/setup-rust@v1
  with:
    cache-base: master
    # With regex
    cache-base: (master|main|develop)
```

## Compared to

### `actions-rs/*`

The "official" actions have served their purpose, but after 3 years of no updates, severe lack of
maintenance, and being full of deprecation warnings, it was time to create something new.

Outside of being evergreen, this action also supports the following features:

- Automatically caches.
- Installs Cargo bins.
- Assumes `rustup`, `cargo`, and other commands are available globally. This allows you to use them
  directly in a `run` command, without having to use `actions-rs/cargo`.

### `dtolnay/rust-toolchain`

Our action is very similar to theirs, which was a great implementation reference, but our action
also supports the following features:

- Extracts the toolchain/channel from `rust-toolchain.toml` and `rust-toolchain` configuration
  files.
- Automatically caches.
- Installs Cargo bins.

### `Swatinem/rust-cache`

Their action only caches for Rust/Cargo, it doesn't actually setup Rust/Cargo. Our action is meant
to do _everything_, but it's not as configurable as the alternatives.

Here are the key differences between the two:

- Theirs caches the entire `~/.cargo` directory, while our action only caches `~/.cargo/registry`.
  [View the reasoning above](#caching-in-ci).
  - Our action also avoids an array of `~/.cargo/bin` issues that theirs currently has.
- Theirs includes compiler specific environment variables in the cache key, while our action
  currently does not.
- Theirs supports a handful of inputs for controlling the cache key, while ours does not.
- Theirs is a bit more smart in what it caches, while ours is a bit more brute force. We simply
  cache specific directories as-is after cleaning.

### `taiki-e/install-action`

Their action is versatile for installing a wide range of development tools, including Rust binaries, primarily from GitHub Releases. While our action focuses on a comprehensive Rust environment setup (toolchain, caching, and binaries), their action is specialized in tool installation.

Here are some key differences:

- Our action is an all-in-one solution for Rust CI (toolchain, caching, binaries via `bins` input); theirs focuses on general tool installation and does not handle Rust toolchain setup or caching.
- Both actions install Rust binaries: ours uses `cargo-binstall` directly for the `bins` input, while theirs uses `cargo-binstall` as a fallback for tools not in its manifests.
- Theirs offers fine-grained version control for a wide array of tools; our action supports versioning for binaries installed via the `bins` input (e.g., `cargo-insta@1.28.0`).

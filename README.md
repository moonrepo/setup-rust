# Setup Rust

A GitHub action for setting up Rust and Cargo. Will automatically install the appropriate toolchain
with `rustup` by inspecting the `RUSTUP_TOOLCHAIN` environment variable or the `rust-toolchain.toml`
configuration file.

## Installation

```yaml
# ...
jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      # ...
      - uses: moonrepo/setup-rust@v0
      - run: cargo test
```

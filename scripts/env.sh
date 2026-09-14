#!/bin/sh
# Explicitly select the released beta, including when tey is a local checkout wrapper.
export TEY_KEX="${TEY_HOME:-$HOME/.local/share/tey}/toolchains/0.4.0-beta.2/bin/kex"
if [ -x /opt/homebrew/opt/erlang/bin/erl ]; then
  export KEX_ERL=/opt/homebrew/opt/erlang/bin/erl
fi

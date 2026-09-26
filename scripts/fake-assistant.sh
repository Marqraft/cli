#!/bin/sh
# Stands in for an AI command line in specs (spec/assistant.spec.kex), as
# the claude CLI or as a configured command. Each call N writes its
# arguments, one per line, to $FAKE_ASSISTANT/args.N and prints
# $FAKE_ASSISTANT/reply.N, or $FAKE_ASSISTANT/reply when there is none.
[ "$1" = "--version" ] && { echo "fake-assistant 1.0"; exit 0; }
dir=${FAKE_ASSISTANT:?}
n=$(( $(cat "$dir/count" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$dir/count"
: > "$dir/args.$n"
for argument in "$@"; do printf '%s\n' "$argument" >> "$dir/args.$n"; done
if [ -f "$dir/reply.$n" ]; then cat "$dir/reply.$n"; else cat "$dir/reply"; fi
exit "$(cat "$dir/status" 2>/dev/null || echo 0)"

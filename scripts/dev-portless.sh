#!/usr/bin/env sh
set -eu

name="$(sh scripts/portless-name.sh exile)"
export PORTLESS_PORT="${PORTLESS_PORT:-1355}"

proxy_is_up() {
  curl -sk -o /dev/null --max-time 2 "https://127.0.0.1:${PORTLESS_PORT}/" 2>/dev/null
}

if ! proxy_is_up; then
  global_root="$(npm root -g 2>/dev/null || true)"
  global_cli="${global_root}/portless/dist/cli.js"
  if [ -n "$global_root" ] && [ -f "$global_cli" ]; then
    (cd /tmp && node "$global_cli" proxy start --https --skip-trust >/dev/null 2>&1 &)
  else
    (cd /tmp && portless proxy start --https --skip-trust >/dev/null 2>&1 &)
  fi

  attempt=0
  while [ "$attempt" -lt 20 ]; do
    if proxy_is_up; then break; fi
    attempt=$((attempt + 1))
    sleep 0.3
  done
fi

exec portless "$name" --force "$@"

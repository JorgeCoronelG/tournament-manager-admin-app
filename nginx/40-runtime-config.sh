#!/bin/sh
# Runs at container start (nginx entrypoint) as the unprivileged nginx user.
# Renders the deployment settings into /tmp, which is writable even when the
# root filesystem is read-only.
#
#   API_URL  Base URL of the API. Default: /api (same origin).
#            An absolute URL is also allowed by the Content-Security-Policy.
set -eu

API_URL="${API_URL:-/api}"

case "$API_URL" in
  *[\"\\\ ]* | *[[:space:]]*)
    echo "40-runtime-config: API_URL must not contain quotes, backslashes or spaces" >&2
    exit 1
    ;;
  http://* | https://*)
    origin=$(printf '%s' "$API_URL" | sed -E 's#^(https?://[^/]+).*#\1#')
    connect_src="'self' $origin"
    ;;
  *)
    connect_src="'self'"
    ;;
esac

printf '{"apiUrl":"%s"}\n' "$API_URL" > /tmp/config.json
sed "s|__CONNECT_SRC__|$connect_src|" \
  /etc/nginx/security-headers.inc.template > /tmp/security-headers.inc

echo "40-runtime-config: apiUrl=$API_URL connect-src=$connect_src"

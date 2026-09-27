#!/bin/sh
# Runs at container start (nginx entrypoint) as the unprivileged nginx user.
# Renders the deployment settings into /tmp, which is writable even when the
# root filesystem is read-only.
#
#   API_URL       Base URL of the API. Default: /api (same origin).
#                 An absolute URL is also allowed by the Content-Security-Policy.
#   AUTH_API_URL  Base URL of the authentication API. Default: /api (same origin).
set -eu

API_URL="${API_URL:-/api}"
AUTH_API_URL="${AUTH_API_URL:-/api}"

connect_src="'self'"

for url in "$API_URL" "$AUTH_API_URL"; do
  case "$url" in
    *[\"\\\ ]* | *[[:space:]]*)
      echo "40-runtime-config: API_URL/AUTH_API_URL must not contain quotes, backslashes or spaces" >&2
      exit 1
      ;;
    http://* | https://*)
      origin=$(printf '%s' "$url" | sed -E 's#^(https?://[^/]+).*#\1#')
      case " $connect_src " in
        *" $origin "*) ;;
        *) connect_src="$connect_src $origin" ;;
      esac
      ;;
  esac
done

printf '{"apiUrl":"%s","authApiUrl":"%s"}\n' "$API_URL" "$AUTH_API_URL" > /tmp/config.json
sed "s|__CONNECT_SRC__|$connect_src|" \
  /etc/nginx/security-headers.inc.template > /tmp/security-headers.inc

echo "40-runtime-config: apiUrl=$API_URL authApiUrl=$AUTH_API_URL connect-src=$connect_src"

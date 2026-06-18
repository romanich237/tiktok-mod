#!/usr/bin/env bash
set -euo pipefail

is_supported_distro() {
  [[ -f /etc/os-release ]] || return 1
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID,,}" in
    ubuntu|debian) return 0 ;;
  esac
  case "${ID_LIKE:-}" in
    *debian*|*ubuntu*) return 0 ;;
  esac
  return 1
}

if ! is_supported_distro; then
  echo "TikTok Mod поддерживает только Ubuntu/Debian."
  exit 1
fi

cd "$(dirname "$0")"
node install.js "$@"

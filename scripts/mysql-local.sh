#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CNF="$ROOT/deploy/mysql-local.cnf"
DATADIR="$ROOT/mysql-data"

if [[ ! -f "$CNF" ]]; then
  echo "deploy/mysql-local.cnf не найден — сначала запустите install.sh" >&2
  exit 1
fi

sudo mkdir -p "$DATADIR"
sudo chown mysql:mysql "$DATADIR"

if [[ ! -f "$DATADIR/ibdata1" ]]; then
  echo "[tiktok-mod-mysql] Инициализация данных в $DATADIR"
  sudo mysqld --initialize-insecure --datadir="$DATADIR" --user=mysql
fi

exec sudo mysqld --defaults-file="$CNF" --user=mysql

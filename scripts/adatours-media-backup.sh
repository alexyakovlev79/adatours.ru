#!/usr/bin/env bash
# Pull-only backup of Ada Tours' public-media Yandex Object Storage bucket.
# Requires: bash, rclone, python3, flock, sha256sum (for optional local spot check).
set -Eeuo pipefail
umask 077

SOURCE="${ADA_SOURCE:-ada-yandex:img.adatours.ru}"
ROOT="${ADA_BACKUP_ROOT:-/srv/backups/adatours-media}"
CONFIG="${ADA_RCLONE_CONFIG:-/etc/adatours-media-backup/rclone.conf}"
MIN_OBJECTS="${ADA_MIN_OBJECTS:-1000}"
VERIFY_DOW="${ADA_FULL_VERIFY_DOW:-7}"  # ISO weekday: 1=Mon ... 7=Sun; 0 disables.
ALERT_EMAIL="${ADA_ALERT_EMAIL:-}"

for command in rclone python3 flock; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 127; }
done
[[ -r "$CONFIG" ]] || { echo "Cannot read rclone config: $CONFIG" >&2; exit 1; }
[[ "$SOURCE" == *:* ]] || { echo 'ADA_SOURCE must be an rclone remote:path' >&2; exit 1; }
[[ "$ROOT" == /* && "$ROOT" != / ]] || { echo 'ADA_BACKUP_ROOT must be an absolute non-root path' >&2; exit 1; }
[[ "$MIN_OBJECTS" =~ ^[0-9]+$ ]] || { echo 'ADA_MIN_OBJECTS must be an integer' >&2; exit 1; }
[[ "$VERIFY_DOW" =~ ^[0-7]$ ]] || { echo 'ADA_FULL_VERIFY_DOW must be 0...7' >&2; exit 1; }

mkdir -p "$ROOT/current" "$ROOT/history" "$ROOT/state"
exec 9>"$ROOT/state/backup.lock"
if ! flock -n 9; then
  echo 'Backup already running; concurrent invocation skipped.'
  exit 0
fi

START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
STATUS_TMP="$ROOT/state/source-$RUN_ID.json"
SUCCESS_TMP="$ROOT/state/success-$RUN_ID.json"
ERROR_PATH="$ROOT/state/last-error.txt"
cleanup() { rm -f "$STATUS_TMP" "$SUCCESS_TMP"; }
on_error() {
  local exit_code="$?"
  trap - ERR
  printf 'FAILED %s exit=%s source=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$exit_code" "$SOURCE" > "$ERROR_PATH"
  echo "Ada Tours backup FAILED (exit $exit_code), see: $ERROR_PATH" >&2
  if [[ -n "$ALERT_EMAIL" ]] && command -v mail >/dev/null; then
    printf 'Ada Tours backup failed at %s (exit %s). Inspect systemd journal and %s.\n' "$START" "$exit_code" "$ERROR_PATH" |
      mail -s 'Ada Tours MEDIA BACKUP FAILED' "$ALERT_EMAIL" || true
  fi
  cleanup
  exit "$exit_code"
}
trap on_error ERR
trap cleanup EXIT

# List ALL objects, not just the new-upload ledger in GitHub.
rclone --config "$CONFIG" size "$SOURCE" --json > "$STATUS_TMP"
python3 - "$STATUS_TMP" "$ROOT/state/last-success.json" "$MIN_OBJECTS" <<'PY'
import json, pathlib, sys
current = json.loads(pathlib.Path(sys.argv[1]).read_text())
count, size = int(current.get('count', -1)), int(current.get('bytes', -1))
minimum = int(sys.argv[3])
if count < minimum or size <= 0:
    raise SystemExit(f'Unexpectedly small/empty source: {count} objects, {size} bytes')
last = pathlib.Path(sys.argv[2])
if last.exists():
    old = json.loads(last.read_text())
    old_count = int(old.get('source_objects', 0))
    if old_count >= minimum and count < old_count * .9:
        raise SystemExit(f'Source object count dropped >10%: {old_count} -> {count}; requires investigation')
print(f'Yandex source: {count} objects, {size} bytes')
PY

# Never use rclone sync/move or --delete. Changed local files are archived.
# Old objects that vanish from S3 remain in current/; older overwritten copies go to history/.
rclone --config "$CONFIG" copy "$SOURCE" "$ROOT/current" \
  --backup-dir "$ROOT/history/$RUN_ID" \
  --transfers 4 --checkers 8 --retries 3 --low-level-retries 5 \
  --stats-one-line --stats 60s

# Every day: existence and byte-size for all *currently present* source files.
rclone --config "$CONFIG" check "$SOURCE" "$ROOT/current" \
  --one-way --size-only --checkers 8
VERIFICATION='size'
# First backup or each selected weekday: compare actual content by downloading source bytes.
if [[ ! -f "$ROOT/state/last-success.json" ]] || \
   [[ "$VERIFY_DOW" != 0 && "$(date -u +%u)" == "$VERIFY_DOW" ]]; then
  rclone --config "$CONFIG" check "$SOURCE" "$ROOT/current" \
    --one-way --download --checkers 4
  VERIFICATION='download'
fi

python3 - "$STATUS_TMP" "$SUCCESS_TMP" "$START" "$VERIFICATION" "$SOURCE" <<'PY'
import datetime, json, pathlib, sys
source = json.loads(pathlib.Path(sys.argv[1]).read_text())
result = {'last_success_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'start_utc': sys.argv[3], 'source': sys.argv[5],
          'source_objects': int(source['count']), 'source_bytes': int(source['bytes']),
          'verified': sys.argv[4], 'deletes_from_backup': False}
pathlib.Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
PY
mv -f "$SUCCESS_TMP" "$ROOT/state/last-success.json"
rm -f "$ERROR_PATH"
echo "Ada Tours backup OK: $RUN_ID; verification=$VERIFICATION"

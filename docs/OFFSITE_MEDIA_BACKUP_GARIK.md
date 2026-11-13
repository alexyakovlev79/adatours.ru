# Ada Tours — offsite media backup on Garik's server

**Status:** prepared installation package; not yet installed on Garik's server. 13 November 2026.  
**Source of truth:** the complete Yandex Object Storage bucket `img.adatours.ru`.  
**Destination:** a separate persistent disk on Garik's existing server (which hosts `adatours.com` and other sites).  
**Unchanged:** GitHub Pages, Astro, Yandex Cloud uploads, DNS, CDN, and all other websites.

## Why back up the full bucket

On 8–9 October 2026, **2,981** historical files were migrated to Yandex S3; they are not necessarily in the newer direct-upload ledger. As of 13 November 2026, `src/data/media/direct-s3-uploads.json` additionally has **6,581** direct-upload receipts (images and short videos). **Do not back up only this JSON list.** Enumerate the S3 bucket itself, including `media/` and any other media prefixes.

The backup is **pull-only**: no credentials capable of changing or deleting source files. The script uses `rclone copy`, never `sync` or `move`: objects removed from S3 stay on Garik's disk, overwritten files are archived into a dated `history/` directory. Initial full copy, then incremental daily updates. Recovery point: up to 24 hours plus timer jitter.

## 1. One-time read-only access (Ada Tours Yandex Cloud admin)

1. Create a separate service account named `adatours-backup-readonly` in the relevant Yandex Cloud folder.
2. Assign role **`storage.viewer` to the SINGLE bucket `img.adatours.ru`** using **Object Storage → bucket → Security → Access rights**. Do not grant role on the whole folder/cloud or use `storage.editor`. Do not replace the bucket's existing ACL or its public-read setup.
3. Create a **static S3 access key** for this service account. Give the access key ID and secret to Garik **privately** using an agreed secure channel, not in this GitHub repository, an Issue, a group message, a PR or ChatGPT.
4. Verify with `rclone lsf` that the key can read and list objects. It must not be able to upload, delete, or overwrite production objects. No destructive test against production.

Official docs: [bucket-specific IAM](https://yandex.cloud/ru/docs/storage/operations/buckets/iam-access), [storage.viewer](https://yandex.cloud/ru/docs/storage/security/), [service accounts](https://yandex.cloud/ru/docs/iam/operations/sa/create), [static keys](https://yandex.cloud/ru/docs/iam/operations/authentication/manage-access-keys), [rclone + Yandex S3](https://yandex.cloud/ru/docs/storage/tools/rclone).

## 2. Garik: server installation (Linux + systemd)

Needs Bash, rclone, Python 3, flock (util-linux), systemd, and free space on a persistent disk. Set up a dedicated backup location instead of mixing backup files into the `adatours.com` webroot. None of this requires editing nginx or the production sites.

From a local checkout or the accompanying archive, copy:

- `scripts/adatours-media-backup.sh` → `/usr/local/sbin/adatours-media-backup.sh`
- `deploy/backup/adatours-media-backup.service` → `/etc/systemd/system/`
- `deploy/backup/adatours-media-backup.timer` → `/etc/systemd/system/`

```bash
sudo install -d -m 0700 /etc/adatours-media-backup /srv/backups/adatours-media
sudo install -m 0750 scripts/adatours-media-backup.sh /usr/local/sbin/adatours-media-backup.sh
sudo install -m 0644 deploy/backup/adatours-media-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/backup/adatours-media-backup.timer /etc/systemd/system/
```

Use a **root-owned, mode 0600** local file `/etc/adatours-media-backup/rclone.conf`. Insert REAL keys locally, never commit this file:

```ini
[ada-yandex]
type = s3
provider = Other
env_auth = false
access_key_id = <ACCESS_KEY_ID>
secret_access_key = <SECRET_ACCESS_KEY>
region = ru-central1
endpoint = https://storage.yandexcloud.net
```

```bash
sudo chown root:root /etc/adatours-media-backup/rclone.conf
sudo chmod 0600 /etc/adatours-media-backup/rclone.conf
sudo rclone --config /etc/adatours-media-backup/rclone.conf lsf ada-yandex:img.adatours.ru --max-depth 1
sudo rclone --config /etc/adatours-media-backup/rclone.conf size ada-yandex:img.adatours.ru --json
```

Optional `/etc/adatours-media-backup/settings.env` (root-owned, mode 0600):

```ini
ADA_BACKUP_ROOT=/srv/backups/adatours-media
ADA_SOURCE=ada-yandex:img.adatours.ru
ADA_RCLONE_CONFIG=/etc/adatours-media-backup/rclone.conf
ADA_MIN_OBJECTS=1000
ADA_FULL_VERIFY_DOW=7
# ADA_ALERT_EMAIL=your-working-alert-mailbox@example.org
```

If the archive lives on another disk, change `ADA_BACKUP_ROOT` and mount that disk persistently BEFORE enabling the timer. For alerts, either configure a working `mail` program and `ADA_ALERT_EMAIL`, or hook the systemd service failures/last-success timestamp to Garik's existing monitoring. Without a working notification channel, errors are only recorded locally.

## 3. First full copy and daily schedule

```bash
sudo systemctl daemon-reload
sudo systemctl start adatours-media-backup.service
sudo systemctl status adatours-media-backup.service --no-pager
sudo cat /srv/backups/adatours-media/state/last-success.json
sudo find /srv/backups/adatours-media/current -type f | wc -l
sudo systemctl enable --now adatours-media-backup.timer
systemctl list-timers --all | grep adatours-media-backup
```

Runs daily around **03:30 server local time** with up to 15 minutes of random delay and missed-run catch-up. The oneshot service is normally inactive after success. Review its journal using:

```bash
sudo journalctl -u adatours-media-backup.service -n 120 --no-pager
```

Result layout:

- `current/`: current latest-known original byte copies, including items later deleted in S3.
- `history/<runId>/`: old local versions before a replacement.
- `state/last-success.json`: date/time, source object count/bytes and verification mode.
- `state/last-error.txt`: failure marker (cleared on the next success).

Daily: check all currently present source files against local copies by **file size**. Initial run and each Sunday (UTC): additionally compare the **actual bytes** with `rclone check --download --one-way`. Source count dropping by more than 10% aborts the run for investigation; nothing on the backup disk is deleted. Simulated success/failure tests for the script have been run locally; real S3 and Garik-server tests have **not** been completed.

## 4. Acceptance and monitoring

Garik should perform a non-destructive restore of 1–2 files **into a temporary folder**, confirm the restored images/video are readable, and send back: backup disk path/free space, initial number/size of source objects, `last-success.json` timestamp, test-restore result, timer status and alert destination. No passwords, access keys, private keys or server root access should be sent in that report.

If `last-success.json` is older than **36 hours**, alert an administrator. Review disk usage and old-version retention periodically; do not delete `history/` without agreement. The first copy and weekly bytewise verification create Yandex S3 download traffic; monitor any applicable egress charges. This is daily backup, not immediate replication. Loss of the entire Garik server is still a separate risk.

The backup runner never uses GitHub Actions, S3 write credentials or any server changes related to `adatours.com`.

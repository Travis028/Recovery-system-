# LDRS v6 — database

| Item | Value |
|---|---|
| Server | PostgreSQL 16 in Docker — `docker-compose.yml` in this project (compose project name pinned to `ldrs_project_folder_ver5`, service `db`, volume `ldrs_project_folder_ver5_ldrs_pgdata`) |
| Host / port | `127.0.0.1:5433` |
| Database / user | `ldrs_local` / `ldrs_app` |
| Schema used by LDRS v6 | `ldrs_v6` — 17 tables |
| Old pilot tables | `public.*` (users, sessions, documents, loss_reports, matches, audit_log) — never written by LDRS v6 |

## Files

| File | Use |
|---|---|
| `migrations/001_create_isolated_v6_schema.sql` | Creates the `ldrs_v6` schema (already applied to your database) |
| `migrations/002_add_location_fields.sql` | v6: county / sub-county / ward / landmark columns on documents and loss reports |

**Apply migrations with `cd backend && npm run migrate`** — it applies only what is not yet recorded in
`ldrs_v6.schema_migrations`, each in its own transaction, and is safe to run again. `npm run migrate -- --status` lists them.
The backend refuses to start (with a clear message) while a migration is pending.
| `checks/verify_schema.sql` | Read-only: lists the schema, its 17 tables and the migration ledger |
| `queries/useful_queries.sql` | Read-only record counts and recent activity |
| `reference/v5_pilot_public_tables.sql` | Reference copy of the old pilot `public.*` tables. Do not run. |

Quick connection check without SQL tools: `cd backend && npm run check:db`.

## New empty database (only if you ever start fresh)

```bash
cd backend
npm run migrate      # creates the schema (001) and later changes (002 …)
npm run seed:dev     # prints 4 fictional accounts once
```

## Backups

The database and the photo files are stored separately. A full backup needs **both**:

```bash
# 1. Database (run in the project folder, where docker-compose.yml is)
docker compose exec -T db pg_dump -U ldrs_app -d ldrs_local -n ldrs_v6 -Fc > ldrs_v6_$(date +%Y%m%d).dump

# 2. Photos + keys (from LDRS_Project_folder_ver6)
tar czf ldrs_private_files_$(date +%Y%m%d).tar.gz -C backend .private-photo-key .private-collection-key .private-document-photos
```

Restore the dump with `pg_restore` into the same database. The key files must go back into `backend/` unchanged,
otherwise stored photos cannot be decrypted and old receipts no longer verify. Never run `docker compose down -v`
(it deletes the database volume). Keep backups private; they contain test personal data.

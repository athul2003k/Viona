# #!/bin/bash
# # Migration script: add org-based storage columns to File table
# # Safe to run multiple times (uses IF NOT EXISTS and ON CONFLICT)

# set -e

# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ENV_FILE="$SCRIPT_DIR/.env"

# if [ ! -f "$ENV_FILE" ]; then
#   echo "ERROR: .env file not found at $ENV_FILE"
#   exit 1
# fi

# export $(grep -v '^#' "$ENV_FILE" | xargs)

# if [ -z "$DATABASE_URL" ]; then
#   echo "ERROR: DATABASE_URL not found in .env"
#   exit 1
# fi

# echo "==> Running org-storage migration..."

# psql "$DATABASE_URL" <<'SQL'

# INSERT INTO storage_users (id, email, "storageUsed", "createdAt", "updatedAt")
# VALUES ('system', 'system@viona.internal', 0, NOW(), NOW())
# ON CONFLICT (id) DO NOTHING;

# ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "orgId" TEXT;

# ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "isOrgFolder" BOOLEAN NOT NULL DEFAULT false;

# CREATE INDEX IF NOT EXISTS "File_orgId_idx" ON "File"("orgId");

# SQL

# echo "==> Migration complete!"

#!/usr/bin/env bash
# Compares edge functions deployed on the source project (staging) against the
# destination project (prod) and, optionally, promotes the ones that differ.
#
# Comparison is by each deployed function's content checksum (the API's
# `ezbr_sha256` field), not by version number - version counters are private
# to each project, so "source v29 vs dest v3" proves nothing about whether the
# code actually differs. A checksum mismatch does.
#
# The function list itself is the UNION of: local supabase/functions/*
# directories, functions deployed on source, and functions deployed on dest -
# so a function deployed on staging with no local source (an orphan left
# behind by a later `git rm`) shows up as a warning instead of silently
# vanishing from the report.
#
# Only functions that are BOTH present locally AND already deployed on source
# are ever deploy candidates - this is a source-to-destination promotion
# script, so it deliberately will not push straight to prod something that
# hasn't been deployed (and so, presumably, exercised) on staging first.
#
# Usage:
#   ./scripts/sync-edge-functions.sh --view
#   ./scripts/sync-edge-functions.sh --deploy [--yes]
#
# Env overrides:
#   SOURCE_REF   Supabase project ref to compare FROM (default: staging)
#   DEST_REF     Supabase project ref to compare/deploy TO (default: prod)
#   FUNCTIONS_DIR  Path to the functions directory (default: supabase/functions,
#                  resolved from project/)
set -euo pipefail

cd "$(dirname "$0")/../project"

SOURCE_REF="${SOURCE_REF:-swgxitzcylokelhqlcfe}"   # salam-motors-staging
DEST_REF="${DEST_REF:-zhapnnvlypdmwfdsiprv}"       # bolt-native-database (prod)
FUNCTIONS_DIR="${FUNCTIONS_DIR:-supabase/functions}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--view|-v] [--deploy|-d] [--yes|-y]

  --view,   -v   List every edge function (local + deployed on either
                 project) with its sync status between source and
                 destination. Read-only.
  --deploy, -d   Same report, then deploy every function that is on source
                 and out of sync (or missing) on destination. Prompts for
                 confirmation per function unless --yes is also given.
  --yes,    -y   Skip the per-function confirmation prompt in --deploy mode.
  --help,   -h   Show this help.

Currently:  SOURCE_REF=$SOURCE_REF  DEST_REF=$DEST_REF
Override with env vars, e.g.: SOURCE_REF=xxx DEST_REF=yyy $(basename "$0") -v
EOF
}

MODE=""
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --view|-v) MODE="view"; shift ;;
    --deploy|-d) MODE="deploy"; shift ;;
    --yes|-y) ASSUME_YES=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  usage
  exit 1
fi

command -v supabase >/dev/null 2>&1 || { echo "supabase CLI not found on PATH" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required (apt install jq / brew install jq)" >&2; exit 1; }

if [[ ! -d "$FUNCTIONS_DIR" ]]; then
  echo "Functions directory not found: $FUNCTIONS_DIR (run this from the repo, not elsewhere)" >&2
  exit 1
fi

echo "Fetching deployed function state from source ($SOURCE_REF) and destination ($DEST_REF)..." >&2
SOURCE_JSON=$(supabase functions list --project-ref "$SOURCE_REF" -o json)
DEST_JSON=$(supabase functions list --project-ref "$DEST_REF" -o json)

mapfile -t LOCAL_FUNCTIONS < <(find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_shared' -exec basename {} \; | sort)
mapfile -t SOURCE_FUNCTIONS < <(echo "$SOURCE_JSON" | jq -r '.[].name' | sort)
mapfile -t DEST_FUNCTIONS < <(echo "$DEST_JSON" | jq -r '.[].name' | sort)

# Union of all three lists, de-duplicated.
mapfile -t ALL_FUNCTIONS < <(printf '%s\n' "${LOCAL_FUNCTIONS[@]}" "${SOURCE_FUNCTIONS[@]}" "${DEST_FUNCTIONS[@]}" | sort -u)

is_in() {
  local needle="$1"; shift
  local x
  for x in "$@"; do [[ "$x" == "$needle" ]] && return 0; done
  return 1
}

declare -a NEEDS_DEPLOY=()

printf "%-24s %-6s %-9s %-9s %s\n" "FUNCTION" "LOCAL" "SRC VER" "DST VER" "STATUS"
printf '%.0s-' $(seq 1 80); echo

for fn in "${ALL_FUNCTIONS[@]}"; do
  src_entry=$(echo "$SOURCE_JSON" | jq -c --arg n "$fn" '[.[] | select(.name == $n)] | first // null')
  dst_entry=$(echo "$DEST_JSON" | jq -c --arg n "$fn" '[.[] | select(.name == $n)] | first // null')

  local_present="no"; is_in "$fn" "${LOCAL_FUNCTIONS[@]}" && local_present="yes"

  src_ver=$(echo "$src_entry" | jq -r '.version // "-"')
  dst_ver=$(echo "$dst_entry" | jq -r '.version // "-"')
  src_sha=$(echo "$src_entry" | jq -r '.ezbr_sha256 // ""')
  dst_sha=$(echo "$dst_entry" | jq -r '.ezbr_sha256 // ""')

  on_source="no"; [[ "$src_entry" != "null" ]] && on_source="yes"
  on_dest="no"; [[ "$dst_entry" != "null" ]] && on_dest="yes"

  if [[ "$local_present" == "no" && "$on_source" == "yes" ]]; then
    status="ORPHAN ON SOURCE (no local code - cannot deploy)"
  elif [[ "$local_present" == "no" && "$on_dest" == "yes" ]]; then
    status="ORPHAN ON DEST (no local code)"
  elif [[ "$on_source" == "no" ]]; then
    status="NOT ON SOURCE YET (deploy to staging first)"
  elif [[ "$on_dest" == "no" ]]; then
    status="NEW -> DEPLOY"
    NEEDS_DEPLOY+=("$fn")
  elif [[ "$src_sha" != "$dst_sha" ]]; then
    status="OUT OF SYNC -> DEPLOY"
    NEEDS_DEPLOY+=("$fn")
  else
    status="IN SYNC"
  fi

  printf "%-24s %-6s %-9s %-9s %s\n" "$fn" "$local_present" "$src_ver" "$dst_ver" "$status"
done

echo

if [[ "$MODE" == "view" ]]; then
  exit 0
fi

# --deploy from here on
if [[ ${#NEEDS_DEPLOY[@]} -eq 0 ]]; then
  echo "Nothing to deploy - destination already matches source for every deployable function."
  exit 0
fi

echo "Candidates for deploy to destination ($DEST_REF): ${NEEDS_DEPLOY[*]}"
echo

for fn in "${NEEDS_DEPLOY[@]}"; do
  if [[ "$ASSUME_YES" != true ]]; then
    read -r -p "Deploy '$fn' to $DEST_REF? [y/N] " reply
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
      echo "Skipped $fn"
      continue
    fi
  fi
  echo "Deploying $fn to $DEST_REF..."
  supabase functions deploy "$fn" --project-ref "$DEST_REF"
done

echo "Done."

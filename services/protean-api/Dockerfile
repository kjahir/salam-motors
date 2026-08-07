# Protean API — the dealership's Protean-facing service.
#
# Pinned to a specific Deno version rather than :latest so a rebuild months from now
# produces the same runtime; this container sits behind a whitelisted IP and is not
# somewhere to discover a runtime regression.
FROM denoland/deno:alpine-2.1.4

WORKDIR /app

# Dependencies first, so a code change does not re-download the module graph.
COPY deno.json ./
COPY src ./src

# Compile the module graph into the image. Without this, the first request after every
# cold start pays for fetching and type-checking https:// imports — and if the VPC
# restricts egress to Protean and Supabase only, that fetch would fail outright.
RUN deno cache src/main.ts

# Least privilege: this service reads config from the environment and speaks to exactly
# two hosts. It has no reason to touch the filesystem or spawn anything.
USER deno
EXPOSE 8080

# Exec form, so the command is not re-parsed by a shell — this used to live in the
# `docker run` line of deploy.sh, where the quoting had to survive ssh, bash and docker
# in turn. The image is the right place for it: one definition, verified at build time.
#
# No permission flags: `deno eval` runs fully trusted in Deno 2 and rejects `--allow-net`
# outright, which marks the container unhealthy forever rather than failing visibly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["deno", "eval", "const r = await fetch('http://localhost:8080/health'); if (!r.ok) Deno.exit(1);"]

CMD ["deno", "run", "--allow-net", "--allow-env", "src/main.ts"]

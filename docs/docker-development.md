# Docker development

This method runs the Vite development server in the repository's supported
Node.js 22 environment while keeping source files on the host for live reload.
Docker Compose stores container dependencies in a named volume, so host
`node_modules` contents and platform-specific binaries are not mixed with the
container installation.

## Prerequisites

- A current Docker installation with Docker Compose v2 (Docker Desktop also works).
- Ports `5173` must be available on the host.

No host installation of Node.js or npm is required for this workflow.

## Start the development server

From the repository root, build the image and start Vite:

```bash
docker compose up --build
```

Open <http://localhost:5173>. Changes made in the host working tree are mounted
into the container and trigger Vite reloads. Press `Ctrl+C` to stop an attached
session, or run the stack in the background with `docker compose up --build -d`
and stop it later with:

```bash
docker compose down
```

## Run project commands

Run checks in a one-off container that uses the same image and dependency
volume. For example:

```bash
docker compose run --rm web npm run test:run
docker compose run --rm web npm run build
docker compose run --rm web npm run verify
```

Use `docker compose exec web <command>` instead when the development service is
already running. The Playwright end-to-end suite requires browser binaries that
are not installed in the lightweight development image; run it in the documented
host/CI environment rather than this container.

## Refresh dependencies and clean up

After `package.json` or `package-lock.json` changes, rebuild the image and
recreate the dependency volume so it is initialized from the new image:

```bash
docker compose down --volumes
docker compose up --build
```

`docker compose down --volumes` deletes only this Compose project's named
dependency volume. It does not delete source files from the bind-mounted working
tree.

## API limitations

This Docker method intentionally matches `npm run dev`: Vite mirrors only
`/api/iplookup`. It does not run the full Cloudflare Pages Functions and
rate-limiter Worker topology. For currency rates, website font extraction, or
service-binding integration, use the two-terminal Wrangler method in
[`CONTRIBUTING.md`](../CONTRIBUTING.md#local-development) on the host.

Never copy `.dev.vars`, `.env` files, Wrangler state, or credentials into an
image. The checked-in `.dockerignore` excludes these local files from the build
context.

# Build scripts for monorepo

All workspaces can be built individually or as a group.

## Build individual workspace

```bash
pnpm build --filter=@rune-race/web
pnpm build --filter=@rune-race/server
pnpm build --filter=@rune-race/shared
```

## Deploy to Vercel

The `vercel.json` config references the web app build.

## Deploy to Render

The `render.yaml` config references the server deployment.

## Environment setup

Copy `.env.example` to `.env` and fill in your Supabase credentials.

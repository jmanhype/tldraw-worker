# tldraw-worker

Fork of [tldraw/tldraw-sync-cloudflare](https://github.com/tldraw/tldraw-sync-cloudflare), modified to deploy as a single Cloudflare Workers project.

## What It Does

Provides a multiplayer whiteboard backend using tldraw sync. Each room runs in a Cloudflare Durable Object with WebSocket connections. Static assets (images, video) are stored in R2.

This is the same architecture that runs tldraw.com. Each Durable Object handles roughly 30 simultaneous collaborators per room.

## Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19, Vite | Canvas UI via tldraw SDK |
| Sync backend | Cloudflare Workers | WebSocket routing |
| Room state | Durable Objects | 1 instance per active room |
| Asset storage | Cloudflare R2 | Images, videos, room snapshots |
| Link previews | cloudflare-workers-unfurl | Bookmark metadata extraction |

When a room has no connected clients, the Durable Object shuts down. Room data persists in R2 between sessions.

## Project Structure

```
worker/
  worker.ts                  # Route definitions
  TldrawDurableObject.ts     # Sync room (TLSocketRoom over WS)
  assetUploads.ts            # R2 upload/download/caching
client/
  App.tsx                    # Main component, wires sync to <Tldraw />
  multiplayerAssetStore.tsx  # Asset upload/retrieval
  getBookmarkPreview.tsx     # Bookmark preview fetching
```

## Requirements

- Node.js (see package.json for version)
- Cloudflare account
- R2 bucket (update `bucket_name` in `wrangler.jsonc`)

## Development

```bash
npm install
npm start        # Vite dev server
npm run deploy   # Build + deploy to Cloudflare Workers
```

## Limitations

- No authentication layer -- rooms are accessible to anyone with the URL
- No server-side access control on asset uploads
- ~30 collaborator limit per room is a soft ceiling, not a hard cap

## License

MIT. The tldraw SDK itself is under the [tldraw license](https://github.com/tldraw/tldraw/blob/main/LICENSE.md).

Upstream: [tldraw/tldraw-sync-cloudflare](https://github.com/tldraw/tldraw-sync-cloudflare)

import { AutoRouter, error, type IRequest } from "itty-router";
import { handleUnfurlRequest } from "cloudflare-workers-unfurl";
import { handleAssetUpload, handleAssetDownload } from "./assetUploads";
import type { Environment } from "./types";

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from "./TldrawDurableObject";

// we use itty-router (https://itty.dev/) to handle routing.

// If your frontend is on a different domain, you can use the
// cors middleware to allow requests from that domain.
// import cors from "itty-router";
// const { preflight, corsify } = cors({ origin: "*" });

const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
  // before: [preflight],
  // finally: [corsify],
  catch: (e) => {
    console.error("Error in router", e);
    return error(e);
  },
})
  // requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
  .get("/connect/:roomId", (request, env) => {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId);
    const room = env.TLDRAW_DURABLE_OBJECT.get(id);
    return room.fetch(request.url, {
      headers: request.headers,
      body: request.body,
    });
  })

  // assets can be uploaded to the bucket under /uploads:
  .post("/uploads/:uploadId", handleAssetUpload)

  // they can be retrieved from the bucket too:
  .get("/uploads/:uploadId", handleAssetDownload)

  // bookmarks need to extract metadata from pasted URLs:
  .get("/unfurl", handleUnfurlRequest);

// export our router for cloudflare
export default {
  fetch(request: Request, env: Environment, ctx: ExecutionContext) {
    return router.fetch(request, env, ctx);
  },
};

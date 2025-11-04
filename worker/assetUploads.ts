import { IRequest, error } from "itty-router";
import { Environment } from "./types";

/**
 * Sanitizes an upload ID and returns the R2 object key for storing assets.
 * Assets are stored in the bucket under the /uploads path with sanitized names.
 * @param uploadId - The upload identifier to sanitize
 * @returns The sanitized object name for R2 storage
 */
function getAssetObjectName(uploadId: string) {
  return `uploads/${uploadId.replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
}

/**
 * Handles asset upload requests. Validates content type and stores images/videos in R2.
 * Only accepts image/* and video/* content types.
 * @param request - The incoming upload request with asset data
 * @param env - Cloudflare environment bindings (R2 bucket access)
 * @returns Success response or error if validation fails
 */
export async function handleAssetUpload(request: IRequest, env: Environment) {
  const objectName = getAssetObjectName(request.params.uploadId);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return error(400, "Invalid content type");
  }

  if (await env.TLDRAW_BUCKET.head(objectName)) {
    return error(409, "Upload already exists");
  }

  await env.TLDRAW_BUCKET.put(objectName, request.body, {
    httpMetadata: request.headers,
  });

  return { ok: true };
}

/**
 * Handles asset download requests with caching. Retrieves assets from R2 and caches them
 * on Cloudflare's edge network. Supports range requests for video streaming.
 * @param request - The incoming download request
 * @param env - Cloudflare environment bindings (R2 bucket access)
 * @param ctx - Execution context for managing cache operations
 * @returns The asset response with appropriate headers and caching
 */
export async function handleAssetDownload(
  request: IRequest,
  env: Environment,
  ctx: ExecutionContext
) {
  // @ts-expect-error - this is a workaround to get the default cache
  const defaultCache = caches.default as Cache;

  const objectName = getAssetObjectName(request.params.uploadId);

  // if we have a cached response for this request (automatically handling ranges etc.), return it
  const cacheKey = new Request(request.url, { headers: request.headers });
  const cachedResponse = await defaultCache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // if not, we try to fetch the asset from the bucket
  const object = await env.TLDRAW_BUCKET.get(objectName, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (!object) {
    return error(404);
  }

  // write the relevant metadata to the response headers
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // assets are immutable, so we can cache them basically forever:
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);

  // we set CORS headers so all clients can access assets. we do this here so our `cors` helper in
  // worker.ts doesn't try to set extra cors headers on responses that have been read from the
  // cache, which isn't allowed by cloudflare.
  headers.set("access-control-allow-origin", "*");

  // cloudflare doesn't set the content-range header automatically in writeHttpMetadata, so we
  // need to do it ourselves.
  let contentRange;
  if (object.range) {
    if ("suffix" in object.range) {
      const start = object.size - object.range.suffix;
      const end = object.size - 1;
      contentRange = `bytes ${start}-${end}/${object.size}`;
    } else {
      const start = object.range.offset ?? 0;
      const end = object.range.length
        ? start + object.range.length - 1
        : object.size - 1;
      if (start !== 0 || end !== object.size - 1) {
        contentRange = `bytes ${start}-${end}/${object.size}`;
      }
    }
  }

  if (contentRange) {
    headers.set("content-range", contentRange);
  }

  // make sure we get the correct body/status for the response
  const body = "body" in object && object.body ? object.body : null;
  const status = body ? (contentRange ? 206 : 200) : 304;

  // we only cache complete (200) responses
  if (status === 200) {
    const [cacheBody, responseBody] = body!.tee();
    ctx.waitUntil(
      defaultCache.put(cacheKey, new Response(cacheBody, { headers, status }))
    );
    return new Response(responseBody, { headers, status });
  }

  return new Response(body, { headers, status });
}

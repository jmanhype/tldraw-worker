import {
  AssetRecordType,
  TLAsset,
  TLBookmarkAsset,
  getHashForString,
} from "tldraw";

/**
 * Fetches bookmark preview metadata from the server for a given URL.
 * Creates a bookmark asset with title, description, image, and favicon.
 * Falls back to empty metadata if the unfurling fails.
 * @param url - The URL to fetch preview metadata for
 * @returns A TLBookmarkAsset with preview metadata
 */
export async function getBookmarkPreview({
  url,
}: {
  url: string;
}): Promise<TLAsset> {
  // we start with an empty asset record
  const asset: TLBookmarkAsset = {
    id: AssetRecordType.createId(getHashForString(url)),
    typeName: "asset",
    type: "bookmark",
    meta: {},
    props: {
      src: url,
      description: "",
      image: "",
      favicon: "",
      title: "",
    },
  };

  try {
    // try to fetch the preview data from the server
    const response = await fetch(`/unfurl?url=${encodeURIComponent(url)}`);
    const data = await response.json<
      | {
          description: string;
          image: string;
          favicon: string;
          title: string;
        }
      | undefined
    >();

    // fill in our asset with whatever info we found
    asset.props.description = data?.description ?? "";
    asset.props.image = data?.image ?? "";
    asset.props.favicon = data?.favicon ?? "";
    asset.props.title = data?.title ?? "";
  } catch (e) {
    console.error(e);
  }

  return asset;
}

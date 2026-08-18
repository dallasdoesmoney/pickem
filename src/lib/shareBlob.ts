// Extracted from the byte-identical native-share/download dance that the
// weekly picks page and the season predictor had each grown their own
// copy of. The tier list is the third caller, which is one too many to
// keep duplicating - especially the non-obvious pointer-coarse guard.

export type ShareMethod = "download" | "native_share";

export type ShareBlobOpts = {
  blob: Blob;
  filename: string;
  // navigator.share title/text. Ignored on the download path.
  title: string;
  text: string;
  // Fires once, with whichever route actually delivered the image, so
  // callers can log their own analytics event without this helper
  // needing to know about posthog.
  onShared?: (method: ShareMethod) => void;
};

// Hands a rendered PNG to the OS share sheet where that genuinely works,
// and falls back to a plain download everywhere else.
export async function shareBlob({ blob, filename, title, text, onShared }: ShareBlobOpts) {
  const file = new File([blob], filename, { type: "image/png" });

  function download() {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    onShared?.("download");
  }

  // Desktop Chrome (especially macOS) frequently advertises file sharing
  // support and then aborts immediately with no working share target -
  // confirmed on-device. Coarse pointer (touch) is a much more reliable
  // signal for "has a real native share sheet" than canShare() alone,
  // which the API spec never ties to that.
  const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const canShareFiles = isTouchPrimary && !!navigator.canShare?.({ files: [file] });

  if (!canShareFiles) {
    download();
    return;
  }

  try {
    await navigator.share({ files: [file], title, text });
    onShared?.("native_share");
  } catch (shareErr) {
    // A user backing out of the share sheet is not a failure - only fall
    // back to a download when the share actually broke.
    if (!(shareErr instanceof Error && shareErr.name === "AbortError")) download();
  }
}

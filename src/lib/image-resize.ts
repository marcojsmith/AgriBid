/**
 * Client-side image compression helpers used before uploading files to
 * Convex storage. Resizing large photos client-side keeps uploads fast and
 * stops the storage bucket from filling with oversized originals.
 */

/** Longest allowed edge of an uploaded image after resizing. */
export const MAX_UPLOAD_IMAGE_DIMENSION = 1600;

/** JPEG quality used when re-encoding resized images. */
export const RESIZE_JPEG_QUALITY = 0.8;

/**
 * Target pixel dimensions for a resized image.
 */
interface TargetDimensions {
  width: number;
  height: number;
}

/**
 * Compute the pixel dimensions an image must be resized to so its longest
 * edge fits within `maxDimension`, preserving aspect ratio. Images already
 * within the limit are returned unchanged.
 *
 * @param width - Original image width in pixels.
 * @param height - Original image height in pixels.
 * @param maxDimension - Maximum allowed width or height in pixels.
 * @returns The target dimensions (unchanged when already within bounds).
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxDimension: number
): TargetDimensions {
  const largest = Math.max(width, height);
  if (largest <= maxDimension || largest === 0) {
    return { width, height };
  }

  const scale = maxDimension / largest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Re-encode an image file as a JPEG whose longest edge is at most
 * `maxDimension`, drawn onto a white background so transparent PNGs don't
 * turn black. Non-image files (e.g. PDFs) are returned untouched, and any
 * failure (unsupported browser, corrupt file, unavailable canvas) falls back
 * to the original file so an upload is never blocked by resizing.
 *
 * @param file - The file selected by the user.
 * @param maxDimension - Maximum allowed edge length; defaults to
 * {@link MAX_UPLOAD_IMAGE_DIMENSION}.
 * @returns The resized JPEG blob, or the original file when resizing is
 * not applicable or fails.
 */
export async function resizeImageFile(
  file: File,
  maxDimension: number = MAX_UPLOAD_IMAGE_DIMENSION
): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = computeTargetDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension
    );

    if (width === 0 || height === 0) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (result) => {
          resolve(result);
        },
        "image/jpeg",
        RESIZE_JPEG_QUALITY
      );
    });

    return blob ?? file;
  } catch {
    return file;
  }
}

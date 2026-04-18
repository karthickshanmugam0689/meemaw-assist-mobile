import * as ImageManipulator from "expo-image-manipulator";

/**
 * Resize an image down to fit within maxSide and return its base64-encoded JPEG.
 * SDK 54 expo-image-manipulator still exposes the legacy manipulateAsync helper.
 */
export async function resizeToJpegBase64(
  uri: string,
  maxSide = 1280,
  compress = 0.85
): Promise<{ uri: string; base64: string }> {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxSide } }],
    {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  return { uri: out.uri, base64: out.base64 ?? "" };
}

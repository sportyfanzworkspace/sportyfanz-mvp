import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Client } from "basic-ftp";
import sharp from "sharp";

export type ImageCategory =
  | "predictions"
  | "polls"
  | "trivia";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_777_216;

const IMAGE_TYPES = {
  jpeg: {
    extension: "jpg",
    contentType: "image/jpeg",
  },
  png: {
    extension: "png",
    contentType: "image/png",
  },
  webp: {
    extension: "webp",
    contentType: "image/webp",
  },
} as const;

export async function uploadImageToQServers(
  file: File,
  category: ImageCategory
): Promise<string> {
  if (!["predictions", "polls", "trivia"].includes(category)) {
    throw new Error("Invalid image category.");
  }

  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must not exceed 2 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  const processor = sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_PIXELS,
    animated: false,
  });

  const metadata = await processor.metadata();

  if (
    !metadata.format ||
    !(metadata.format in IMAGE_TYPES)
  ) {
    throw new Error("Unsupported image format.");
  }

  const format = metadata.format as keyof typeof IMAGE_TYPES;
  const imageType = IMAGE_TYPES[format];

  if (file.type !== imageType.contentType) {
    throw new Error("Image MIME type mismatch.");
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_DIMENSION ||
    metadata.height > MAX_DIMENSION
  ) {
    throw new Error("Invalid image dimensions.");
  }

  // Re-encode to validate image data and remove metadata.
  // The output is not written to disk.
  let output: Buffer;

  if (format === "jpeg") {
    output = await processor
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } else if (format === "png") {
    output = await processor
      .png({ compressionLevel: 9 })
      .toBuffer();
  } else {
    output = await processor
      .webp({ quality: 85 })
      .toBuffer();
  }

  if (
    output.length === 0 ||
    output.length > MAX_IMAGE_BYTES
  ) {
    throw new Error(
      "Processed image exceeds the 2 MB limit."
    );
  }

  const host = process.env.QSERVERS_FTPS_HOST;
  const username = process.env.QSERVERS_FTPS_USERNAME;
  const password = process.env.QSERVERS_FTPS_PASSWORD;

  if (!host || !username || !password) {
    throw new Error(
      "QServers image storage is not configured."
    );
  }

  const filename =
    `${randomUUID()}.${imageType.extension}`;

  const client = new Client(20000);

  try {
    await client.access({
      host,
      port: 21,
      user: username,
      password,
      secure: true,
      secureOptions: {
        rejectUnauthorized: true,
      },
    });

    await client.ensureDir(category);

    await client.uploadFrom(
      Readable.from(output),
      filename
    );
  } finally {
    client.close();
  }

  return (
    "https://www.sportyfanz.com/uploads/sportyfanz/" +
    `${category}/${filename}`
  );
}

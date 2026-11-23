import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import {
  uploadImageToQServers,
  type ImageCategory,
} from "@/lib/uploads/qservers-ftps";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

const PERMISSIONS = {
  predictions: "predictions:manage",
  polls: "polls:manage",
  trivia: "trivia:manage",
} as const;

export async function POST(request: Request) {
  try {
    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType.toLowerCase().startsWith(
        "multipart/form-data;"
      )
    ) {
      return NextResponse.json(
        { error: "Expected a multipart image upload." },
        { status: 415 }
      );
    }

    const categoryHeader =
      request.headers.get("x-image-category");

    if (
      !categoryHeader ||
      !(categoryHeader in PERMISSIONS)
    ) {
      return NextResponse.json(
        { error: "Invalid image category." },
        { status: 400 }
      );
    }

    const category = categoryHeader as ImageCategory;

    const auth = await requirePermission(
      PERMISSIONS[category]
    );

    if (!auth.authorized) {
      return auth.response;
    }

    const contentLength =
      request.headers.get("content-length");

    if (contentLength !== null) {
      const length = Number(contentLength);

      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > MAX_REQUEST_BYTES
      ) {
        return NextResponse.json(
          { error: "Upload request is too large." },
          { status: 413 }
        );
      }
    }

    const reader = request.body?.getReader();

    if (!reader) {
      return NextResponse.json(
        { error: "Image upload body is required." },
        { status: 400 }
      );
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel();

        return NextResponse.json(
          { error: "Upload request is too large." },
          { status: 413 }
        );
      }

      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: {
        "content-type": contentType,
      },
      body,
    });

    const formData = await boundedRequest.formData();

    const formCategory = formData.get("category");

    if (formCategory !== category) {
      return NextResponse.json(
        { error: "Image category mismatch." },
        { status: 400 }
      );
    }

    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Select an image to upload." },
        { status: 400 }
      );
    }

    if (
      image.size === 0 ||
      image.size > MAX_IMAGE_BYTES
    ) {
      return NextResponse.json(
        { error: "Image must not exceed 2 MB." },
        { status: 413 }
      );
    }

    const imageUrl = await uploadImageToQServers(
      image,
      category
    );

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error("Admin image upload failed:", {
      name: error instanceof Error ? error.name : "Unknown",
      code:
       error && typeof error === "object" && "code" in error
       ? error.code
       : undefined,
      });

    return NextResponse.json(
      { error: "Unable to upload image." },
      { status: 500 }
    );
  }
}

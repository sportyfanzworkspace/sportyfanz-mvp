"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type ImageCategory = "clubs" | "players" | "competitions";

type Props = {
  category: ImageCategory;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onUploadingChange: (uploading: boolean) => void;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export default function DiscoveryImageUpload({
  category,
  label,
  value,
  disabled = false,
  onChange,
  onUploadingChange,
}: Props) {
  const inputId = useId();
  const urlId = useId();

  const fileInput = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!file) {
      setLocalPreview("");
      return;
    }

    const url = URL.createObjectURL(file);
    setLocalPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const preview =
    localPreview || (validHttpsUrl(value) ? value : "");

  useEffect(() => {
    setPreviewFailed(false);
  }, [preview]);

  function clearSelection() {
    setFile(null);

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  function selectFile(selected: File | null) {
    setError("");
    setNotice("");
    setFile(null);

    if (!selected) {
      clearSelection();
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      clearSelection();
      setError("Select a JPEG, PNG or WebP image.");
      return;
    }

    if (
      selected.size === 0 ||
      selected.size > MAX_IMAGE_BYTES
    ) {
      clearSelection();
      setError("Image must not exceed 2 MB.");
      return;
    }

    setFile(selected);
  }

  async function uploadImage() {
    if (!file || disabled || uploadLock.current) return;

    uploadLock.current = true;
    setUploading(true);
    onUploadingChange(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();

      formData.append("category", category);
      formData.append("image", file);

      const response = await apiFetch(
        "/api/admin/uploads/image",
        {
          method: "POST",
          headers: {
            "X-Image-Category": category,
          },
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (
        !response.ok ||
        data.success !== true ||
        typeof data.imageUrl !== "string" ||
        !validHttpsUrl(data.imageUrl)
      ) {
        throw new Error(
          data.error || "Unable to upload image."
        );
      }

      onChange(data.imageUrl);
      clearSelection();

      setNotice(
        "Image uploaded. Save the profile to apply it."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload image."
      );
    } finally {
      uploadLock.current = false;
      setUploading(false);
      onUploadingChange(false);
    }
  }

  function removeImage() {
    clearSelection();
    onChange("");
    setError("");
    setNotice("");
  }

  return (
    <div className="discovery-image-field discovery-field-wide">
      <strong>{label}</strong>

      <div className="discovery-image-layout">
        <div className="discovery-image-preview">
          {preview && !previewFailed ? (
            <img
              src={preview}
              alt={`${label} preview`}
              referrerPolicy="no-referrer"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <span>
              {previewFailed
                ? "Preview unavailable"
                : "No image selected"}
            </span>
          )}
        </div>

        <div className="discovery-image-controls">
          <label htmlFor={inputId}>
            Select image
          </label>

          <input
            id={inputId}
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || uploading}
            onChange={event =>
              selectFile(event.target.files?.[0] ?? null)
            }
          />

          <small>
            JPEG, PNG or WebP. Maximum 2 MB.
          </small>

          {file && (
            <small>
              Selected: {file.name} (
              {(file.size / 1024).toFixed(0)} KB)
            </small>
          )}

          <div className="discovery-image-actions">
            <button
              type="button"
              className="player-primary-button"
              disabled={disabled || uploading || !file}
              onClick={() => void uploadImage()}
            >
              {uploading ? "Uploading..." : "Upload image"}
            </button>

            {(value || file) && (
              <button
                type="button"
                className="discovery-edit-button"
                disabled={disabled || uploading}
                onClick={removeImage}
              >
                Remove image
              </button>
            )}
          </div>
        </div>
      </div>

      <label htmlFor={urlId}>
        Or enter an HTTPS image URL
      </label>

      <input
        id={urlId}
        type="url"
        maxLength={2048}
        placeholder="https://..."
        value={value}
        disabled={disabled || uploading}
        onChange={event => {
          clearSelection();
          setError("");
          setNotice("");
          onChange(event.target.value);
        }}
      />

      {file && !uploading && (
        <small>
          Upload the selected file before saving the profile.
        </small>
      )}

      {error && (
        <p role="alert"
          className="player-message player-error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status"
          className="player-message player-success">
          {notice}
        </p>
      )}
    </div>
  );
}

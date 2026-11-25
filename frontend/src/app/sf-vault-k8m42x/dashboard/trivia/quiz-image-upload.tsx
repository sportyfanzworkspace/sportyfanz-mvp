"use client";

import { useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
  onErrorChange: (failed: boolean) => void;
};

export default function QuizImageUpload({
  label,
  value,
  disabled = false,
  onChange,
  onBusyChange,
  onErrorChange,
}: Props) {
  const inputId = useId();
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function clearImage() {
    if (uploadingRef.current || disabled) return;

    onChange("");
    setError("");
    onErrorChange(false);
  }

  async function uploadImage(file: File) {
    if (uploadingRef.current || disabled) return;

    setError("");
    onErrorChange(false);

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size === 0 ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP image no larger than 2 MB.");
      onErrorChange(true);
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    onBusyChange(true);

    try {
      const formData = new FormData();

      formData.append("category", "trivia");
      formData.append("image", file);

      const response = await apiFetch(
        "/api/admin/uploads/image",
        {
          method: "POST",
          headers: {
            "X-Image-Category": "trivia",
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to upload image."
        );
      }

      if (
        typeof data.imageUrl !== "string" ||
        !data.imageUrl
      ) {
        throw new Error("Invalid image URL returned.");
      }

      onChange(data.imageUrl);
      onErrorChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload image."
      );

      onErrorChange(true);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onBusyChange(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label
        htmlFor={inputId}
        style={{ color: "#a5acc1", fontSize: 13 }}
      >
        {label} (optional)
      </label>

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          event.currentTarget.value = "";

          if (file) {
            void uploadImage(file);
          }
        }}
        style={{
          width: "100%",
          padding: 10,
          border: "1px solid #303447",
          borderRadius: 10,
          background: "#10121b",
          color: "#f5f6fa",
          boxSizing: "border-box",
        }}
      />

      <span style={{ color: "#a5acc1", fontSize: 12 }}>
        JPG, PNG or WebP. Maximum file size: 2 MB.
      </span>

      {uploading && (
        <p
          role="status"
          style={{ color: "#f5b82e", margin: 0 }}
        >
          Uploading image...
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: "#ff7777", margin: 0 }}
        >
          {error}
        </p>
      )}

      {value && (
        <img
          src={value}
          alt={label}
          style={{
            width: "100%",
            maxHeight: 220,
            objectFit: "contain",
            borderRadius: 10,
            border: "1px solid #303447",
            background: "#10121b",
          }}
        />
      )}

      {value && !error && !uploading && (
        <span style={{ color: "#58d6a1", fontSize: 12 }}>
          Image uploaded successfully.
        </span>
      )}

      {(value || error) && (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={clearImage}
          style={{
            justifySelf: "start",
            padding: "9px 14px",
            borderRadius: 9,
            border: "1px solid #303447",
            background: "#252a3a",
            color: "#f5f6fa",
            cursor: "pointer",
          }}
        >
          {value ? "Remove Image" : "Clear Failed Image"}
        </button>
      )}
    </div>
  );
}

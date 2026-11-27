"use client";

import {
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";

import type {
  ProfileType,
  ProfileMap,
} from "./profile-types";

type Props<T extends ProfileType> = {
  type: T;
  render: (profile: ProfileMap[T]) => ReactNode;
};

type ProfileState<T extends ProfileType> =
  | { status: "loading" }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "ready"; profile: ProfileMap[T] };

function ProfileLoading() {
  return (
    <div
      className="white-panel discovery-profile-state"
      role="status"
    >
      <LoaderCircle
        size={30}
        className="animate-spin"
        aria-hidden="true"
      />
      <p>Loading profile...</p>
    </div>
  );
}

function ProfileContent<T extends ProfileType>({
  type,
  slug,
  render,
}: Props<T> & { slug: string }) {
  const [attempt, setAttempt] = useState(0);

  const [state, setState] =
    useState<ProfileState<T>>({
      status: "loading",
    });

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      if (!slug || slug.length > 200) {
        setState({
          status: "error",
          message: "A valid profile could not be identified.",
          retryable: false,
        });
        return;
      }

      setState({ status: "loading" });

      try {
        const params = new URLSearchParams({
          type,
          slug,
        });

        const response = await apiFetch(
          `/api/discover/profile?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (controller.signal.aborted) return;

        if (response.status === 404) {
          setState({
            status: "error",
            message:
              "This profile is unavailable or has not been published.",
            retryable: false,
          });
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load this profile.");
        }

        const result = await response.json();

        if (controller.signal.aborted) return;

        if (
          result.success !== true ||
          result.type !== type ||
          !result.profile ||
          typeof result.profile.id !== "number" ||
          typeof result.profile.name !== "string" ||
          result.profile.slug !== slug
        ) {
          throw new Error("Invalid profile response.");
        }

        setState({
          status: "ready",
          profile: result.profile as ProfileMap[T],
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load this profile.",
          retryable: true,
        });
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, [type, slug, attempt]);

  if (state.status === "loading") {
    return <ProfileLoading />;
  }

  if (state.status === "error") {
    return (
      <div
        className="white-panel discovery-profile-state"
        role="alert"
      >
        <AlertCircle size={30} aria-hidden="true" />

        <h2>Profile unavailable</h2>

        <p>{state.message}</p>

        {state.retryable && (
          <button
            type="button"
            className="discovery-profile-action"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt(value => value + 1);
            }}
          >
            Try Again
          </button>
        )}

        <Link href="/discover/">
          Return to Discover
        </Link>
      </div>
    );
  }

  return render(state.profile);
}

function ProfileRoute<T extends ProfileType>(
  props: Props<T>
) {
  const params = useSearchParams();

  const slug = params.get("slug")?.trim() ?? "";

  return (
    <ProfileContent
      key={`${props.type}:${slug}`}
      {...props}
      slug={slug}
    />
  );
}

export default function DiscoveryProfilePage<
  T extends ProfileType
>(props: Props<T>) {
  return (
    <div className="page discovery-profile-page">
      <Link
        href="/discover/"
        className="discovery-profile-back"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Back to Discover
      </Link>

      <Suspense fallback={<ProfileLoading />}>
        <ProfileRoute {...props} />
      </Suspense>
    </div>
  );
}

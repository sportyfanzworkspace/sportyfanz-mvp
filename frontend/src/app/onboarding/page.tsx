"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";

import {
  ArrowRight,
  Check,
} from "lucide-react";

const sportsVideos = [
  { name: "Football", src: "/videos/football.mp4" },
  { name: "Basketball", src: "/videos/basketball.mp4" },
  { name: "Cricket", src: "/videos/cricket.mp4" },
];

export default function OnboardingPage() {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const activeVideo = sportsVideos[activeVideoIndex];

  return (
    <div className="onboarding-page">

      <div className="onboarding-left">

        <div className="onboarding-brand">
          <Logo />
        </div>

        <span className="onboarding-small">
          Every Sport. Every Fan. Every Moment.
        </span>

        <h1>
          Your Passion.
          <br />
          Your Community.
          <br />
          <span>Your Rewards.</span>
        </h1>

        <p>
          Join the home of sports fans. Watch live
          matches, meet your community, participate
          in challenges and earn rewards for being a fan.
        </p>

        <div className="onboarding-buttons">

          <a
            href="/register"
            className="primary-button"
          >
            Create Account
            <ArrowRight size={16} />
          </a>

          <a
            href="/login"
            className="outline-light"
          >
            Log In
          </a>

        </div>

        <div className="onboarding-features">

          <div>
            <Check size={16} />
            Real fan communities
          </div>

          <div>
            <Check size={16} />
            Live sports experience
          </div>

          <div>
            <Check size={16} />
            Real rewards
          </div>

        </div>

      </div>

      <div className="onboarding-right">

        <div className="onboarding-image-card">

          <video
            key={activeVideo.src}
            className="onboarding-background-video"
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-label={`${activeVideo.name} footage playing in the background`}
            onEnded={() => {
              setActiveVideoIndex(
                (current) => (current + 1) % sportsVideos.length
              );
            }}
            onError={() => {
              setActiveVideoIndex(
                (current) => (current + 1) % sportsVideos.length
              );
            }}
          >
            <source src={activeVideo.src} type="video/mp4" />
          </video>

          <div className="onboarding-image-overlay" />

          <div className="onboarding-sports">
            <span>⚽</span>
            <span>🏀</span>
            <span>🎾</span>
            <span>🥊</span>
          </div>

          <div className="onboarding-image-text">
            <span>SPORTYFANZ</span>

            <h2>
              Where Fans Rule.
            </h2>
          </div>

        </div>

      </div>

    </div>
  );
}
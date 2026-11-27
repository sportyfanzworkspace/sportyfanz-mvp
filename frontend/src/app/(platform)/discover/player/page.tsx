"use client";

import DiscoveryProfilePage from
  "@/components/discovery/profile-page";

import PlayerProfileView from
  "@/components/discovery/player-profile";

export default function PlayerPage() {
  return (
    <DiscoveryProfilePage
      type="player"
      render={profile => (
        <PlayerProfileView profile={profile} />
      )}
    />
  );
}

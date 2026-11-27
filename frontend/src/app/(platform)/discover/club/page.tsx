"use client";

import DiscoveryProfilePage from
  "@/components/discovery/profile-page";

import ClubProfileView from
  "@/components/discovery/club-profile";

export default function ClubPage() {
  return (
    <DiscoveryProfilePage
      type="club"
      render={profile => (
        <ClubProfileView profile={profile} />
      )}
    />
  );
}

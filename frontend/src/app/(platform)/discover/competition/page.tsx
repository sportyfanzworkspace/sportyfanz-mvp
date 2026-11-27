"use client";

import DiscoveryProfilePage from
  "@/components/discovery/profile-page";

import CompetitionProfileView from
  "@/components/discovery/competition-profile";

export default function CompetitionPage() {
  return (
    <DiscoveryProfilePage
      type="competition"
      render={profile => (
        <CompetitionProfileView profile={profile} />
      )}
    />
  );
}

"use client";

import Link from "next/link";

import { useUserProfile } from "@/hooks/use-features";

export function ProfileSetupBanner() {
  const { data: profile, isLoading } = useUserProfile();

  if (isLoading || !profile?.isDefaultAge) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">
      <strong>Set up your analytics profile</strong> — age is still defaulted to
      35.{" "}
      <Link href="/profile" className="font-semibold text-primary hover:underline">
        Add your age & preferences →
      </Link>
    </div>
  );
}

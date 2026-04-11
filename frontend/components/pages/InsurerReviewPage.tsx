"use client";

import InsurerCommandCenter from "@/components/pages/InsurerCommandCenter";

export default function InsurerReviewPage({ claimId }: { claimId: string }) {
  return <InsurerCommandCenter claimId={claimId} />;
}

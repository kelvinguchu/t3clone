import { Suspense } from "react";
import { SharedThreadViewer } from "@/components/share/shared-thread-viewer";
import { SharePageSkeleton } from "@/components/share/share-page-skeleton";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedThreadPage({ params }: Props) {
  const { token } = await params;

  return (
    <Suspense fallback={<SharePageSkeleton />}>
      <SharedThreadViewer shareToken={token} />
    </Suspense>
  );
}

export async function generateMetadata() {
  return {
    title: "T3 Chat - Shared Thread",
    description: "View this shared AI conversation from T3 Chat",
    robots: "noindex",
    openGraph: {
      title: "T3 Chat - Shared Thread",
      description: "View this shared AI conversation from T3 Chat",
      type: "article",
    },
  };
}

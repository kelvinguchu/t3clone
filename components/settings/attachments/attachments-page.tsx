"use client";

import { useState } from "react";
import { AttachmentsList } from "./attachments-list";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function AttachmentsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Fetch standalone attachments (not linked to threads yet)
  const attachments = useQuery(api.attachments.getStandaloneAttachments);

  // Calculate pagination
  const totalItems = attachments?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAttachments = attachments?.slice(startIndex, endIndex) || [];

  return (
    <div className="h-full w-full space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Attachments List */}
      <AttachmentsList
        attachments={currentAttachments}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

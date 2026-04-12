import type { Claim, UploadedDocument, UserRole } from "@/types";

const REQUEST_PREFIX = "Documents requested by insurer:";

export const getQueryOwnerRole = (claim: Claim): UserRole =>
  claim.serviceType === "reimbursement" ? "patient" : "hospital";

export const getLatestInsurerDocumentRequest = (claim: Claim) => {
  const requestEntry = [...claim.timeline]
    .reverse()
    .find((entry) => entry.actor === "insurer" && entry.label.startsWith(REQUEST_PREFIX));

  if (!requestEntry) {
    return null;
  }

  return {
    note: requestEntry.label.replace(REQUEST_PREFIX, "").trim(),
    time: requestEntry.time,
  };
};

export const getSharedDocuments = (claim: Claim): UploadedDocument[] =>
  [...claim.documents].sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());

export const getDocumentsUploadedBy = (claim: Claim, uploadedBy: UserRole) =>
  getSharedDocuments(claim).filter((document) => document.uploadedBy.toLowerCase() === uploadedBy);

export const canRoleUploadForClaim = (claim: Claim, role: UserRole) => {
  const activeRequest = getLatestInsurerDocumentRequest(claim);

  if (role === "patient" && claim.status === "denied") {
    return true;
  }

  if (!activeRequest) {
    return false;
  }

  return getQueryOwnerRole(claim) === role;
};

export const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

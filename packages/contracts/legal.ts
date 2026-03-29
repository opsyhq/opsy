export const CURRENT_TERMS_VERSION = "2026-04-01" as const;
export const CURRENT_PRIVACY_VERSION = "2026-04-01" as const;

export const TERMS_PUBLIC_PATH = "/terms" as const;
export const PRIVACY_PUBLIC_PATH = "/privacy" as const;

export type LegalDocumentType = "terms" | "privacy";
export type LegalAcceptanceScopeType = "org" | "user";
export type LegalRequestSource = "web" | "api" | "mcp" | "pat" | "migration";

export type LegalDocumentMetadata = {
  type: LegalDocumentType;
  title: string;
  version: string;
  effectiveDate: string;
  publicPath: string;
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocumentMetadata> = {
  terms: {
    type: "terms",
    title: "Terms of Service",
    version: CURRENT_TERMS_VERSION,
    effectiveDate: "2026-04-01",
    publicPath: TERMS_PUBLIC_PATH,
  },
  privacy: {
    type: "privacy",
    title: "Privacy Policy",
    version: CURRENT_PRIVACY_VERSION,
    effectiveDate: "2026-04-01",
    publicPath: PRIVACY_PUBLIC_PATH,
  },
} as const;

export type LegalDocumentStatus = LegalDocumentMetadata & {
  required: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  isCurrent: boolean;
};

export type LegalStatusResponse = {
  organizationId: string;
  userId: string | null;
  terms: LegalDocumentStatus;
  privacy: LegalDocumentStatus;
  accepted: {
    terms: boolean;
    privacy: boolean;
    all: boolean;
  };
};

export type AcceptCurrentLegalDocumentsInput = {
  organizationId: string;
};

export const legalRoutes = {
  status: "/legal/status",
  acceptCurrent: "/legal/acceptances/current",
} as const;

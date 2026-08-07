import type { TFunction } from "i18next";

const generatedComplianceMessage = /^Compliance policy "(.+)" \((.+)\) is currently violated\.$/;

const compliancePolicySources: Record<string, { key: string; description: string }> = {
  "RC book required": {
    key: "RC book required",
    description: "Every vehicle must have its Registration Certificate attached.",
  },
  "Insurance required": {
    key: "Insurance required",
    description: "Every vehicle must have proof of insurance attached.",
  },
  "PUC required": {
    key: "PUC required",
    description: "Every vehicle must have a valid PUC certificate attached.",
  },
  "Seller identity required": {
    key: "Seller identity required",
    description: "Every vehicle must have the seller's ID proof attached.",
  },
  "Purchase payments need proof": {
    key: "Purchase payments need proof",
    description: "Every purchase payment must have a supporting screenshot or receipt.",
  },
  "Expenses need bills": {
    key: "Expenses need bills",
    description: "Every submitted or approved expense must have a bill or receipt attached.",
  },
  "Vehicle investments need proof": {
    key: "Vehicle investments need proof",
    description: "Every investment tied to a specific vehicle must have supporting proof attached.",
  },
  "Purchase payments must match price": {
    key: "Purchase payments must match price",
    description: "Total purchase payments must reconcile exactly to the agreed price plus broker commission and other fees.",
  },
};

const policyTitleByDescription = Object.fromEntries(
  Object.entries(compliancePolicySources).map(([title, policy]) => [policy.description, title]),
);

export function translateCompliancePolicyTitle(t: TFunction, title: string): string {
  return t(`compliancePolicies.policies.${title}.title`, { defaultValue: title });
}

function translatePolicyDescriptionByTitle(t: TFunction, title: string, defaultValue: string): string {
  const policy = compliancePolicySources[title];
  if (!policy) return defaultValue;
  return t(`compliancePolicies.policies.${policy.key}.description`, { defaultValue });
}

export function translateCompliancePolicyDescription(
  t: TFunction,
  description: string | null | undefined,
  title?: string,
): string | null | undefined {
  if (!description) return description;

  const match = generatedComplianceMessage.exec(description);
  if (match) {
    return t("compliancePolicies.genericViolation", {
      name: translateCompliancePolicyTitle(t, match[1]),
      category: match[2],
    });
  }

  if (title && compliancePolicySources[title]?.description === description) {
    return translatePolicyDescriptionByTitle(t, title, description);
  }

  const titleFromDescription = policyTitleByDescription[description];
  if (titleFromDescription) {
    return translatePolicyDescriptionByTitle(t, titleFromDescription, description);
  }

  return description;
}

export function translateAlertCopy(t: TFunction, title: string, message: string | null | undefined) {
  return {
    title: translateCompliancePolicyTitle(t, title),
    message: translateCompliancePolicyDescription(t, message, title),
  };
}
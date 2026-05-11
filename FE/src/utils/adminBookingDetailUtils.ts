import { imagePattern, notFoundText } from "../constants/adminBookingDetail";
import { UnknownRecord } from "../types/adminBookingDetail";

export const toNonEmptyString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed || "";
};

export const toDisplayText = (value: unknown): string => {
  if (value == null) return notFoundText;
  if (typeof value === "string") {
    return value.trim() ? value : notFoundText;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return notFoundText;
};

export const pickFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
};

export const getDateTimeText = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    return notFoundText;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

export const collectImageUrls = (source: unknown): string[] => {
  const urls = new Set<string>();

  const visit = (node: unknown) => {
    if (typeof node === "string") {
      const trimmed = node.trim();
      const isUrl = /^https?:\/\//i.test(trimmed);
      if (isUrl && imagePattern.test(trimmed)) {
        urls.add(trimmed);
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== "object") return;

    Object.entries(node as UnknownRecord).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if (typeof value === "string") {
        const trimmed = value.trim();
        const isUrl = /^https?:\/\//i.test(trimmed);
        if (
          isUrl &&
          (lower.includes("image") ||
            lower.includes("photo") ||
            imagePattern.test(trimmed))
        ) {
          urls.add(trimmed);
        }
      }
      visit(value);
    });
  };

  visit(source);
  return [...urls];
};

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export const canForceCancel = (status?: string) => {
  const normalized = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  return normalized === "RESERVED" || normalized === "IN_USE";
};

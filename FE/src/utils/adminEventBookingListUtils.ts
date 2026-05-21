import { EventRow } from "../types/adminEventBookingList";

export const parseDateTime = (value?: string) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const combineDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return "";
  return `${dateValue}T${timeValue}`;
};

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const getEventTimestamp = (record: EventRow) => {
  const candidates = [record.createdAt, record.startTime, record.endTime];
  for (const value of candidates) {
    const parsed = parseDateTime(value);
    if (parsed) return parsed.getTime();
  }
  return 0;
};

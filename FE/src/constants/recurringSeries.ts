export const RECURRING_SERIES_DAYS = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
  { key: "SUNDAY", label: "Sun" },
] as const;

export type RecurringSeriesDay = (typeof RECURRING_SERIES_DAYS)[number]["key"];

export const DEFAULT_RECURRING_SERIES_DAYS: RecurringSeriesDay[] = [
  "MONDAY",
  "WEDNESDAY",
  "FRIDAY",
];

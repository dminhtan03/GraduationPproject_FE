export const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label: `${String(hour).padStart(2, "0")}h`,
}));

export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);

export const toTotalMinutes = (hour: string, minute: string) => {
  return Number(hour) * 60 + Number(minute);
};

export const clampToRange = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const getTimeOptionStyle = (isDisabled: boolean) => ({
  color: isDisabled ? "#94a3b8" : "#0f172a",
  fontWeight: isDisabled ? 400 : 600,
});

export const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentTimeRange = () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    startDate: toDateInputValue(now),
    startHour: String(now.getHours()).padStart(2, "0"),
    startMinute: String(now.getMinutes()).padStart(2, "0"),
    endDate: toDateInputValue(oneHourLater),
    endHour: String(oneHourLater.getHours()).padStart(2, "0"),
    endMinute: String(oneHourLater.getMinutes()).padStart(2, "0"),
  };
};

export const normalizeLocalDateTime = (value: string) => {
  if (!value) return "";
  return value.length === 16 ? `${value}:00` : value;
};

export const buildDateTime = (date: string, hour: string, minute: string) => {
  if (!date || !hour || !minute) return "";
  return `${date}T${hour}:${minute}:00`;
};

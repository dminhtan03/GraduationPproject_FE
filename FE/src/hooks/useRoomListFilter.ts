import { useMemo, useEffect, useState } from "react";
import { useRealtimeClock } from "./useRealtimeClock";
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  clampToRange,
  getCurrentTimeRange,
  toDateInputValue,
  toTotalMinutes,
} from "../utils";
import type { AnimatedDropdownOption } from "../components/common/AnimatedDropdown";

export function useRoomListFilter() {
  const currentTimeRange = useMemo(() => getCurrentTimeRange(), []);
  const clockTick = useRealtimeClock();

  const [startDate, setStartDate] = useState(currentTimeRange.startDate);
  const [startHour, setStartHour] = useState(currentTimeRange.startHour);
  const [startMinute, setStartMinute] = useState(currentTimeRange.startMinute);
  const [endDate, setEndDate] = useState(currentTimeRange.endDate);
  const [endHour, setEndHour] = useState(currentTimeRange.endHour);
  const [endMinute, setEndMinute] = useState(currentTimeRange.endMinute);

  const nowParts = useMemo(() => {
    const now = new Date(clockTick);
    return {
      date: toDateInputValue(now),
      hour: String(now.getHours()).padStart(2, "0"),
      minute: String(now.getMinutes()).padStart(2, "0"),
    };
  }, [clockTick]);

  const minStartMinutes = useMemo(
    () => toTotalMinutes(nowParts.hour, nowParts.minute),
    [nowParts.hour, nowParts.minute]
  );

  const minEndDate = useMemo(
    () => (startDate > nowParts.date ? startDate : nowParts.date),
    [nowParts.date, startDate]
  );

  const minEndMinutes = useMemo(() => {
    const nowMinutes = toTotalMinutes(nowParts.hour, nowParts.minute);
    const startMinutes = toTotalMinutes(startHour, startMinute);

    if (startDate === nowParts.date && minEndDate === nowParts.date) {
      return Math.max(nowMinutes, startMinutes);
    }
    if (minEndDate === nowParts.date) {
      return nowMinutes;
    }
    if (minEndDate === startDate) {
      return startMinutes;
    }
    return 0;
  }, [
    minEndDate,
    nowParts.date,
    nowParts.hour,
    nowParts.minute,
    startDate,
    startHour,
    startMinute,
  ]);

  const minEndHourValue = useMemo(
    () => String(Math.floor(minEndMinutes / 60)).padStart(2, "0"),
    [minEndMinutes]
  );

  const startHourDropdownOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () =>
      HOUR_OPTIONS.map((hour) => ({
        value: hour.value,
        label: `${hour.value}h`,
        disabled:
          startDate === nowParts.date &&
          Number(hour.value) * 60 < minStartMinutes,
      })),
    [minStartMinutes, nowParts.date, startDate]
  );

  const startMinuteDropdownOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () =>
      MINUTE_OPTIONS.map((minute) => ({
        value: minute,
        label: `${minute}m`,
        disabled:
          startDate === nowParts.date &&
          startHour === nowParts.hour &&
          Number(minute) < Number(nowParts.minute),
      })),
    [nowParts.date, nowParts.hour, nowParts.minute, startDate, startHour]
  );

  const endHourDropdownOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () =>
      HOUR_OPTIONS.map((hour) => ({
        value: hour.value,
        label: `${hour.value}h`,
        disabled:
          endDate === minEndDate && Number(hour.value) * 60 < minEndMinutes,
      })),
    [endDate, minEndDate, minEndMinutes]
  );

  const endMinuteDropdownOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () =>
      MINUTE_OPTIONS.map((minute) => ({
        value: minute,
        label: `${minute}m`,
        disabled:
          endDate === minEndDate &&
          endHour === minEndHourValue &&
          Number(minute) < minEndMinutes % 60,
      })),
    [endDate, endHour, minEndDate, minEndHourValue, minEndMinutes]
  );

  useEffect(() => {
    if (startDate < nowParts.date) {
      setStartDate(nowParts.date);
      setStartHour(nowParts.hour);
      setStartMinute(nowParts.minute);
      return;
    }
    if (startDate === nowParts.date) {
      const startMinutes = toTotalMinutes(startHour, startMinute);
      if (startMinutes < minStartMinutes) {
        const safeMinutes = clampToRange(minStartMinutes, 0, 23 * 60 + 59);
        const nextHour = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
        const nextMinute = String(safeMinutes % 60).padStart(2, "0");
        setStartHour(nextHour);
        setStartMinute(nextMinute);
      }
    }
  }, [
    minStartMinutes,
    nowParts.date,
    nowParts.hour,
    nowParts.minute,
    startDate,
    startHour,
    startMinute,
  ]);

  useEffect(() => {
    if (endDate < minEndDate) {
      setEndDate(minEndDate);
      const safeMinutes = clampToRange(minEndMinutes, 0, 23 * 60 + 59);
      setEndHour(String(Math.floor(safeMinutes / 60)).padStart(2, "0"));
      setEndMinute(String(safeMinutes % 60).padStart(2, "0"));
      return;
    }
    if (endDate === minEndDate) {
      const endMinutes = toTotalMinutes(endHour, endMinute);
      if (endMinutes < minEndMinutes) {
        const safeMinutes = clampToRange(minEndMinutes, 0, 23 * 60 + 59);
        setEndHour(String(Math.floor(safeMinutes / 60)).padStart(2, "0"));
        setEndMinute(String(safeMinutes % 60).padStart(2, "0"));
      }
    }
  }, [endDate, endHour, endMinute, minEndDate, minEndMinutes]);

  const clearTimeFilter = () => {
    const nextRange = getCurrentTimeRange();
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
    setStartHour(nextRange.startHour);
    setStartMinute(nextRange.startMinute);
    setEndHour(nextRange.endHour);
    setEndMinute(nextRange.endMinute);
  };

  return {
    startDate, setStartDate,
    startHour, setStartHour,
    startMinute, setStartMinute,
    endDate, setEndDate,
    endHour, setEndHour,
    endMinute, setEndMinute,
    startHourDropdownOptions,
    startMinuteDropdownOptions,
    endHourDropdownOptions,
    endMinuteDropdownOptions,
    nowParts,
    minEndDate,
    clearTimeFilter,
  };
}

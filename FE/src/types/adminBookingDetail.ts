export type UnknownRecord = Record<string, unknown>;

export interface LocationState {
  booking?: UnknownRecord;
}

export interface TimelineItem {
  key: string;
  label: string;
  time: string;
  actor?: string;
  sourceOrder: number;
}

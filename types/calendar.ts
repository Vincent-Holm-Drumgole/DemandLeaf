// Shared type for a content calendar entry, matching the shape returned by GET /api/calendar
export interface CalendarEntry {
  _id: string;
  strategyId: string;
  keyword: string;
  archetype: string;
  scheduledDate: number;
  priority: number;
  status: string;
  briefId?: string;
  keywordId: string;
}

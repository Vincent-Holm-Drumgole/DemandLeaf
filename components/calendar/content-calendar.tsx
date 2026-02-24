"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarItemPopover } from "./calendar-item-popover";

interface CalendarEntry {
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

interface ContentCalendarProps {
  items: CalendarEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 border-blue-200",
  in_progress: "bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 border-green-200",
  skipped: "bg-gray-50 border-gray-200 opacity-50",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ContentCalendar({ items }: ContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map scheduled date → items
  const itemsByDay = (() => {
    const map = new Map<number, CalendarEntry[]>();
    for (const item of localItems) {
      const d = new Date(item.scheduledDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const existing = map.get(day) ?? [];
        map.set(day, [...existing, item]);
      }
    }
    return map;
  })();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleStatusChange = (itemId: string, status: string) => {
    setLocalItems((prev) => prev.map((i) => (i._id === itemId ? { ...i, status } : i)));
  };

  const totalThisMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .flatMap((d) => itemsByDay.get(d) ?? []).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <p className="text-sm text-muted-foreground">{totalThisMonth} posts this month</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t">
        {/* Empty cells before month starts */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="border-r border-b min-h-[80px] bg-muted/20" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dayItems = itemsByDay.get(day) ?? [];
          return (
            <div key={day} className="border-r border-b min-h-[80px] p-1">
              <div className="text-xs text-muted-foreground mb-1">{day}</div>
              <div className="space-y-0.5">
                {dayItems.map((item) => (
                  <CalendarItemPopover
                    key={item._id}
                    item={item}
                    onStatusChange={handleStatusChange}
                  >
                    <button
                      className={`w-full text-left px-1.5 py-0.5 rounded text-xs border truncate transition-colors hover:opacity-80 ${
                        STATUS_COLORS[item.status] ?? "bg-blue-50 border-blue-200"
                      }`}
                    >
                      {item.keyword}
                    </button>
                  </CalendarItemPopover>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded border ${cls}`} />
            {status.replace("_", " ")}
          </div>
        ))}
      </div>
    </div>
  );
}

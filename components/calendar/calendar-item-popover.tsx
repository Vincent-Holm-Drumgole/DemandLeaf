"use client";

import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface CalendarItemPopoverProps {
  item: {
    _id: string;
    keyword: string;
    archetype: string;
    scheduledDate: number;
    priority: number;
    status: string;
    briefId?: string;
  };
  children: React.ReactNode;
  onStatusChange?: (itemId: string, status: string) => void;
}

const STATUS_OPTIONS = ["scheduled", "in_progress", "completed", "skipped"] as const;

export function CalendarItemPopover({ item, children, onStatusChange }: CalendarItemPopoverProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(item.status);
  const [isSaving, setIsSaving] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    const prevStatus = status;
    setStatus(newStatus);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/calendar/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      onStatusChange?.(item._id, newStatus);
    } catch {
      setStatus(prevStatus);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-sm">{item.keyword}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{item.archetype}</Badge>
              <span className="text-xs text-muted-foreground">#{item.priority}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Status</p>
            <Select value={status} onValueChange={handleStatusChange} disabled={isSaving}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {item.briefId ? (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                <Link href={`/brief/${item.briefId}`}>
                  <ExternalLink className="h-3 w-3 mr-1" /> View Brief
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No brief linked yet for this keyword.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

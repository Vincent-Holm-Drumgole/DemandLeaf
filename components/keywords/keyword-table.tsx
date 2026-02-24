"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const INTENT_VARIANT: Record<string, string> = {
  informational: "bg-blue-100 text-blue-800",
  commercial: "bg-purple-100 text-purple-800",
  transactional: "bg-green-100 text-green-800",
  navigational: "bg-gray-100 text-gray-800",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  unassigned: "outline",
  briefed: "secondary",
  written: "default",
  published: "default",
  ranking: "default",
};

export interface KeywordRow {
  _id: string;
  keyword: string;
  searchVolume?: number;
  keywordDifficulty?: number;
  cpc?: number;
  searchIntent?: string;
  opportunityScore?: number;
  status: string;
  clusterId?: string;
}

interface KeywordTableProps {
  keywords: KeywordRow[];
  onGenerateBrief?: (keywordId: string) => void;
}

export function KeywordTable({ keywords, onGenerateBrief }: KeywordTableProps) {
  if (keywords.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 border rounded-md">
        No keywords found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">KD</TableHead>
            <TableHead className="text-right">CPC</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead>Status</TableHead>
            {onGenerateBrief && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.map((kw) => (
            <TableRow key={kw._id}>
              <TableCell className="font-medium max-w-[200px] truncate">{kw.keyword}</TableCell>
              <TableCell className="text-right">
                {kw.searchVolume !== undefined ? kw.searchVolume.toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-right">
                {kw.keywordDifficulty !== undefined ? (
                  <span
                    className={`font-medium ${
                      kw.keywordDifficulty >= 70
                        ? "text-destructive"
                        : kw.keywordDifficulty >= 40
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {kw.keywordDifficulty}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">
                {kw.cpc !== undefined ? `$${kw.cpc.toFixed(2)}` : "—"}
              </TableCell>
              <TableCell>
                {kw.searchIntent && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      INTENT_VARIANT[kw.searchIntent] ?? "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {kw.searchIntent}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {kw.opportunityScore !== undefined
                  ? Math.round(kw.opportunityScore).toLocaleString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[kw.status] ?? "outline"}>{kw.status}</Badge>
              </TableCell>
              {onGenerateBrief && (
                <TableCell>
                  {kw.status === "unassigned" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGenerateBrief(kw._id)}
                    >
                      Brief
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ClusterBubble } from "@/types/content-map";
import type { ColorMode } from "./view-toggle";
import { ARCHETYPE_LIST } from "@/lib/constants/archetypes";

interface BubbleNode extends ClusterBubble, d3.SimulationNodeDatum {
  r: number;
  fill: string;
}

interface TooltipState {
  x: number;
  y: number;
  node: BubbleNode;
}

interface BubbleChartProps {
  clusters: ClusterBubble[];
  colorMode: ColorMode;
  onClusterClick?: (cluster: ClusterBubble) => void;
}

const ARCHETYPE_COLORS = d3.schemeTableau10;
const BUYER_STAGE_COLORS: Record<string, string> = {
  awareness: "#6ee7b7",
  consideration: "#93c5fd",
  decision: "#fca5a5",
};

function getColor(node: ClusterBubble, mode: ColorMode): string {
  switch (mode) {
    case "coverage": {
      const ratio =
        node.keywordCount > 0 ? node.coveredCount / node.keywordCount : 0;
      if (ratio >= 0.8) return "#4ade80";
      if (ratio >= 0.5) return "#fbbf24";
      return "#f87171";
    }
    case "seo": {
      const s = node.avgSeoScore;
      if (s === null) return "#d1d5db";
      if (s >= 80) return "#4ade80";
      if (s >= 60) return "#fbbf24";
      return "#f87171";
    }
    case "buyerStage":
      return BUYER_STAGE_COLORS[node.dominantBuyerStage ?? ""] ?? "#d1d5db";
    case "archetype": {
      const archetypes = ARCHETYPE_LIST.map((a) => a.id);
      const idx = archetypes.findIndex((id) => id === node.dominantArchetype);
      return idx >= 0 ? ARCHETYPE_COLORS[idx % ARCHETYPE_COLORS.length] : "#d1d5db";
    }
  }
}

export function BubbleChart({ clusters, colorMode, onClusterClick }: BubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onClusterClickRef = useRef(onClusterClick);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dims, setDims] = useState({ width: 600, height: 480 });

  useEffect(() => {
    onClusterClickRef.current = onClusterClick;
  }, [onClusterClick]);

  // Responsive width via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setDims({ width: w, height: Math.max(360, w * 0.65) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || clusters.length === 0) return;

    const { width, height } = dims;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const maxKw = Math.max(...clusters.map((c) => c.keywordCount), 1);
    const rScale = d3.scaleSqrt().domain([0, maxKw]).range([28, 80]);

    const nodes: BubbleNode[] = clusters.map((c) => ({
      ...c,
      r: rScale(c.keywordCount),
      fill: getColor(c, colorMode),
    }));

    const sim = d3
      .forceSimulation(nodes)
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<BubbleNode>((d) => d.r + 6).iterations(4)
      )
      .force("charge", d3.forceManyBody().strength(-20))
      .stop();

    let rafId: number | null = null;
    let disposed = false;

    const drawNodes = () => {
      if (disposed) return;

      const g = svg.append("g");

      const node = g
        .selectAll<SVGGElement, BubbleNode>("g.bubble")
        .data(nodes)
        .join("g")
        .attr("class", "bubble")
        .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
        .style("cursor", "pointer")
        .on("mousemove", (event, d) => {
          const svg = svgRef.current;
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          setTooltip({
            x: event.clientX - rect.left + 12,
            y: event.clientY - rect.top - 8,
            node: d,
          });
        })
        .on("mouseleave", () => setTooltip(null))
        .on("click", (_, d) => onClusterClickRef.current?.(d));

      node
        .append("circle")
        .attr("r", (d) => d.r)
        .attr("fill", (d) => d.fill)
        .attr("stroke", (d) => (d.gapCount > 0 ? "#ef4444" : "transparent"))
        .attr("stroke-width", 2)
        .attr("fill-opacity", 0.85);

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .attr("font-size", (d) => Math.max(9, Math.min(13, d.r / 4)))
        .attr("font-weight", "600")
        .attr("fill", "#1e293b")
        .text((d) => {
          const maxChars = Math.floor(d.r / 4.5);
          return d.name.length > maxChars
            ? d.name.slice(0, maxChars) + "…"
            : d.name;
        });

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.1em")
        .attr("font-size", (d) => Math.max(8, Math.min(11, d.r / 5)))
        .attr("fill", "#475569")
        .text((d) => `${d.coveredCount}/${d.keywordCount} kw`);
    };

    const targetTicks = Math.min(200, Math.max(60, clusters.length * 3));
    const ticksPerFrame = 20;
    let remainingTicks = targetTicks;

    const advanceSimulation = () => {
      if (disposed) return;

      const steps = Math.min(remainingTicks, ticksPerFrame);
      for (let i = 0; i < steps; i++) {
        sim.tick();
      }
      remainingTicks -= steps;

      if (remainingTicks > 0) {
        rafId = requestAnimationFrame(advanceSimulation);
        return;
      }

      drawNodes();
    };

    advanceSimulation();

    return () => {
      disposed = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      sim.stop();
    };
  }, [clusters, colorMode, dims]);

  if (clusters.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        No clusters yet — run strategy discovery first
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        width={dims.width}
        height={dims.height}
        className="overflow-visible"
      />

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-[200px] rounded-md border bg-card px-3 py-2 text-xs shadow-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-semibold text-sm">{tooltip.node.name}</p>
          <p className="text-muted-foreground mt-0.5">
            Pillar: {tooltip.node.pillarKeyword}
          </p>
          <p className="text-muted-foreground">
            {tooltip.node.blogCount} blog{tooltip.node.blogCount !== 1 ? "s" : ""}
            {" · "}
            {tooltip.node.coveredCount}/{tooltip.node.keywordCount} keywords
          </p>
          {tooltip.node.avgSeoScore !== null && (
            <p className="text-muted-foreground">
              Avg SEO: {tooltip.node.avgSeoScore}
            </p>
          )}
          {tooltip.node.gapCount > 0 && (
            <p className="text-red-500 font-medium mt-1">
              {tooltip.node.gapCount} gap{tooltip.node.gapCount !== 1 ? "s" : ""} detected
            </p>
          )}
        </div>
      )}
    </div>
  );
}

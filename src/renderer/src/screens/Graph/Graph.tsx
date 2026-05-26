import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../components/useI18n";

type ObsidianNode = {
  id: string;
  label: string;
  path: string;
  tags: string[];
  links: string[];
};

type PositionedNode = ObsidianNode & { x: number; y: number };

function hashPosition(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h << 5) - h + seed.charCodeAt(i);
  return Math.abs(h) % max;
}

function buildLayout(nodes: ObsidianNode[]): PositionedNode[] {
  return nodes.map((node) => ({
    ...node,
    x: 8 + hashPosition(node.id + "x", 84),
    y: 8 + hashPosition(node.id + "y", 84),
  }));
}

export default function Graph(): React.JSX.Element {
  const { t } = useI18n();
  const [vaultPath, setVaultPath] = useState("");
  const [nodes, setNodes] = useState<PositionedNode[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [intensity, setIntensity] = useState<"low" | "medium" | "high">("medium");

  useEffect(() => {
    let alive = true;
    window.hermesAPI
      .readObsidianGraph()
      .then((data) => {
        if (!alive) return;
        const laidOut = buildLayout(data.nodes);
        setVaultPath(data.vaultPath);
        setNodes(laidOut);
        setSelectedId(laidOut[0]?.id || "");
      })
      .catch(() => {
        if (!alive) return;
        setNodes([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const tags = useMemo(() => {
    const s = new Set<string>();
    for (const n of nodes) for (const tg of n.tags) s.add(tg);
    return ["all", ...Array.from(s).sort()];
  }, [nodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((n) => {
      const byTag = tag === "all" || n.tags.indexOf(tag) >= 0;
      const byQuery =
        !q ||
        n.label.toLowerCase().indexOf(q) >= 0 ||
        n.path.toLowerCase().indexOf(q) >= 0 ||
        n.tags.join(" ").toLowerCase().indexOf(q) >= 0;
      return byTag && byQuery;
    });
  }, [nodes, query, tag]);

  const visibleIds = useMemo(() => new Set(filtered.map((n) => n.id)), [filtered]);

  const edges = useMemo(() => {
    const out: Array<{ from: PositionedNode; to: PositionedNode }> = [];
    const map = new Map<string, PositionedNode>();
    for (const n of nodes) map.set(n.id, n);
    const dedupe = new Set<string>();
    for (const from of nodes) {
      if (!visibleIds.has(from.id)) continue;
      for (const link of from.links) {
        const to = map.get(link);
        if (!to || !visibleIds.has(to.id)) continue;
        const a = from.id < to.id ? from.id : to.id;
        const b = from.id < to.id ? to.id : from.id;
        const key = a + "::" + b;
        if (!dedupe.has(key)) {
          dedupe.add(key);
          out.push({ from, to });
        }
      }
    }
    return out;
  }, [nodes, visibleIds]);

  const selected = filtered.find((n) => n.id === selectedId) || filtered[0] || null;
  const selectedLinks = new Set(selected?.links || []);

  function updateNodePosition(id: string, x: number, y: number): void {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const nx = Math.min(97, Math.max(3, x));
        const ny = Math.min(97, Math.max(3, y));
        return { ...n, x: nx, y: ny };
      }),
    );
  }

  function onWheel(event: React.WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.min(2.4, Math.max(0.55, Number((z + delta).toFixed(2)))));
  }

  function autoArrange(): void {
    setNodes((prev) => {
      if (prev.length < 2) return prev;
      const next = prev.map((n) => ({ ...n }));
      const map = new Map<string, number>();
      next.forEach((n, i) => map.set(n.id, i));

      for (let step = 0; step < 120; step += 1) {
        const forces = next.map(() => ({ x: 0, y: 0 }));

        for (let i = 0; i < next.length; i += 1) {
          for (let j = i + 1; j < next.length; j += 1) {
            const a = next[i];
            const b = next[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d2 = Math.max(0.01, dx * dx + dy * dy);
            const repulse = 6.5 / d2;
            forces[i].x += (dx * repulse);
            forces[i].y += (dy * repulse);
            forces[j].x -= (dx * repulse);
            forces[j].y -= (dy * repulse);
          }
        }

        for (let i = 0; i < next.length; i += 1) {
          const from = next[i];
          for (const target of from.links) {
            const j = map.get(target);
            if (j === undefined) continue;
            const to = next[j];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const spring = (dist - 12) * 0.015;
            forces[i].x += (dx / dist) * spring;
            forces[i].y += (dy / dist) * spring;
          }
        }

        for (let i = 0; i < next.length; i += 1) {
          next[i].x = Math.min(97, Math.max(3, next[i].x + forces[i].x * 0.55));
          next[i].y = Math.min(97, Math.max(3, next[i].y + forces[i].y * 0.55));
        }
      }

      return next;
    });
  }

  return (
    <div className={`graph-screen jarvis-graph intensity-${intensity}`}>
      <div className="graph-header">
        <h2>{t("graph.title")}</h2>
        <p>{t("graph.subtitle")}</p>
      </div>

      <div className="graph-controls">
        <input
          className="graph-search"
          placeholder={t("graph.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="graph-select" value={tag} onChange={(e) => setTag(e.target.value)}>
          {tags.map((tg) => (
            <option key={tg} value={tg}>
              {tg === "all" ? t("graph.allTags") : "#" + tg}
            </option>
          ))}
        </select>
        <button className="graph-chip" onClick={autoArrange}>
          {t("graph.autoArrange")}
        </button>
        <select
          className="graph-select"
          value={intensity}
          onChange={(e) => setIntensity(e.target.value as "low" | "medium" | "high")}
        >
          <option value="low">{t("graph.intensityLow")}</option>
          <option value="medium">{t("graph.intensityMedium")}</option>
          <option value="high">{t("graph.intensityHigh")}</option>
        </select>
        <button className="graph-chip" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}>
          {t("graph.resetView")}
        </button>
      </div>

      <div className="graph-shell">
        <div
          className="graph-canvas-wrap"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startY = e.clientY;
            const originX = panX;
            const originY = panY;
            const onMove = (ev: MouseEvent): void => {
              setPanX(originX + (ev.clientX - startX) / 5.4);
              setPanY(originY + (ev.clientY - startY) / 5.4);
            };
            const onUp = (): void => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <svg className="graph-canvas" viewBox="0 0 100 100" onWheel={onWheel}>
            <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
              {edges.map(({ from, to }) => {
                const active = selected ? selected.id === from.id || selected.id === to.id : false;
                return (
                  <line
                    key={from.id + "-" + to.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={active ? "graph-edge graph-edge-active" : "graph-edge"}
                  />
                );
              })}

              {filtered.map((node) => {
                const active = selected?.id === node.id;
                const neighbor = selectedLinks.has(node.id);
                const opacity = active || neighbor || !selected ? 1 : 0.5;
                return (
                  <g
                    key={node.id}
                    className={active ? "graph-node graph-node-active pulse" : "graph-node"}
                    style={{ opacity }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedId(node.id);
                      const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      const onMove = (ev: MouseEvent): void => {
                        const nx = ((ev.clientX - rect.left) / rect.width) * 100;
                        const ny = ((ev.clientY - rect.top) / rect.height) * 100;
                        updateNodePosition(node.id, nx, ny);
                      };
                      const onUp = (): void => {
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                  >
                    <circle cx={node.x} cy={node.y} r={active ? 1.95 : 1.35} />
                    <text x={node.x} y={node.y + 3.8} textAnchor="middle" className="graph-label">
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside className="graph-inspector">
          <div className="graph-inspector-title">{selected?.label || "-"}</div>
          <div className="graph-inspector-meta">
            {t("graph.connections", { count: selected?.links.length || 0 })}
          </div>
          <div className="graph-inspector-meta">{selected?.path || "-"}</div>
          <div className="graph-chip-list">
            {(selected?.tags || []).map((tg) => (
              <button key={tg} className="graph-chip" onClick={() => setTag(tg)}>
                #{tg}
              </button>
            ))}
          </div>
          <div className="graph-hint">{t("graph.hint")}</div>
          <div className="graph-hint">{t("graph.vault", { path: vaultPath || "-" })}</div>
          <div className="graph-hint">{t("graph.summary", { nodes: filtered.length, edges: edges.length })}</div>
        </aside>
      </div>
    </div>
  );
}

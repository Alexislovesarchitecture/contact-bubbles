import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import { apiGet } from './api';

type Node = { id: string; displayName: string };
type Edge = { id: string; from: string; to: string; type: string; directed: 0 | 1; strength: number | null };

type GraphResp = { nodes: Node[]; edges: Edge[] };

type Props = { contactId: string; depth: number; types: string[] };

export default function GraphView({ contactId, depth, types }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [graph, setGraph] = useState<GraphResp>({ nodes: [], edges: [] });
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  const typesParam = useMemo(() => types.join(','), [types]);

  useEffect(() => {
    setError(null);
    apiGet<GraphResp>(`/api/graph/local?contactId=${encodeURIComponent(contactId)}&depth=${depth}&types=${encodeURIComponent(typesParam)}`)
      .then(setGraph)
      .catch((e) => setError(String(e)));
  }, [contactId, depth, typesParam]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 900;
    const height = 520;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (ev) => {
        g.attr('transform', ev.transform.toString());
      });

    svg.call(zoom as any);

    const nodes = graph.nodes.map((n) => ({ ...n })) as any[];
    const edges = graph.edges.map((e) => ({ ...e })) as any[];

    // degree-based sizing
    const degree = new Map<string, number>();
    for (const n of nodes) degree.set(n.id, 0);
    for (const e of edges) {
      degree.set(e.from, (degree.get(e.from) || 0) + 1);
      degree.set(e.to, (degree.get(e.to) || 0) + 1);
    }

    const centerId = contactId;

    const link = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke-width', (d) => (d.strength ? 1 + d.strength * 0.4 : 1.2));

    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, any>()
          .on('start', (ev, d) => {
            if (!ev.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (ev, d) => {
            d.fx = ev.x;
            d.fy = ev.y;
          })
          .on('end', (ev, d) => {
            if (!ev.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append('circle')
      .attr('r', (d) => {
        const base = d.id === centerId ? 18 : 12;
        const bump = Math.min(8, (degree.get(d.id) || 0) * 1.2);
        return base + bump * 0.35;
      })
      .attr('fill', (d) => (d.id === centerId ? '#2b6cb0' : '#4a5568'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    node
      .append('text')
      .text((d) => d.displayName)
      .attr('x', 10)
      .attr('y', 4)
      .attr('font-size', 12)
      .attr('fill', '#111');

    node.on('click', (_ev, d: any) => {
      nav(`/contacts/${d.id}`);
    });

    const sim = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(28));

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [graph, contactId, nav]);

  return (
    <div>
      {error ? <div style={{ padding: 10, color: 'crimson' }}>{error}</div> : null}
      <svg ref={svgRef} width="100%" height={520} style={{ background: '#fafafa' }} />
      <div style={{ fontSize: 12, padding: 8, color: '#444' }}>
        Tip: scroll to zoom, drag to pan, drag nodes to reposition, click a node to open that contact.
      </div>
    </div>
  );
}

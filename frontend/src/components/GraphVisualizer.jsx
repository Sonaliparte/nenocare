import React, { useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Activity, X, Info } from 'lucide-react';

const getNodeColor = (group) => {
  switch (group) {
    case 'Patient': return '#00D4FF'; // Vibrant Medical Blue
    case 'Disease': return '#FF4757'; // Alert Red
    case 'Medicine': return '#2ED573'; // Health Green
    case 'Doctor': return '#FFA502'; // Golden Doctor Yellow
    case 'Symptom': return '#FF7F50'; // Symptom Orange
    default: return '#70A1FF';
  }
};

export default function GraphVisualizer({ graphData: incomingGraphData, highlightNodes = new Set(), highlightLinks = new Set(), title = "Knowledge Graph Visualizer" }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const fgRef = useRef();

  // Handle auto-fit zoom on new data load
  useEffect(() => {
    if (fgRef.current && graphData?.nodes?.length > 0) {
      // Small delay to let physics engine position nodes
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  // Sync incomingGraphData to graphData state and handle loading state
  useEffect(() => {
    if (incomingGraphData && incomingGraphData.nodes) {
      setGraphData(incomingGraphData);
      setLoading(false);
    }
  }, [incomingGraphData]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    
    // Zoom and center on the clicked node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.5, 800);
    }
  };

  return (
    <div className="glass-panel" style={{
      position: 'relative',
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      overflow: 'hidden',
      border: '1px solid var(--border-color)'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(5, 8, 17, 0.4)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent-blue)" />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFF' }}>{title}</h4>
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', flexWrap: 'wrap' }}>
          {['Patient', 'Disease', 'Medicine', 'Doctor', 'Symptom'].map(grp => (
            <div key={grp} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getNodeColor(grp),
                display: 'inline-block'
              }} />
              <span style={{ color: 'var(--text-secondary)' }}>{grp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Force Graph Container */}
      <div style={{ flex: 1, position: 'relative', background: '#05070e' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            gap: '8px'
          }}>
            <Activity size={16} className="animate-pulse" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            Loading graph data...
          </div>
        ) : graphData?.nodes?.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            gap: '8px'
          }}>
            <Info size={16} />
            No graph nodes to visualize. Execute a query or search.
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={window.innerWidth > 1024 ? 700 : window.innerWidth - 40}
            height={435}
            nodeLabel={node => `${node.group}: ${node.label}`}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkWidth={link => {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              return highlightLinks.has(`${sourceId}-${targetId}-${link.type}`) ? 3 : 1.5;
            }}
            linkColor={link => {
              const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              return highlightLinks.has(`${sourceId}-${targetId}-${link.type}`) 
                ? '#00D4FF' 
                : 'rgba(255, 255, 255, 0.12)';
            }}
            linkLabel={link => `Relationship: ${link.type}`}
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label;
              const fontSize = 10 / globalScale;
              
              // Draw node circle
              const radius = 5 + (node.group === 'Patient' ? 1.5 : 0);
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
              ctx.fillStyle = getNodeColor(node.group);
              
              // Node glow/outline if selected or highlighted
              const isHighlighted = highlightNodes.has(node.id) || (selectedNode && selectedNode.id === node.id);
              if (isHighlighted) {
                ctx.shadowColor = getNodeColor(node.group);
                ctx.shadowBlur = 12;
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              } else {
                ctx.shadowBlur = 0;
              }
              ctx.fill();
              
              // Draw label text
              if (globalScale > 0.8) {
                ctx.shadowBlur = 0;
                ctx.font = `${fontSize}px Inter`;
                ctx.fillStyle = isHighlighted ? '#FFFFFF' : 'rgba(243, 244, 246, 0.85)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, node.x, node.y + radius + 7);
              }
            }}
            nodeCanvasObjectMode={() => 'replace'}
          />
        )}

        {/* Selected Node Details Sidebar Drawer */}
        {selectedNode && (
          <div className="glass-panel" style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            bottom: '12px',
            width: '280px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            background: 'rgba(8, 12, 26, 0.95)',
            border: `1px solid ${getNodeColor(selectedNode.group)}`,
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            maxHeight: 'calc(100% - 24px)',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <span className="badge" style={{
                backgroundColor: `${getNodeColor(selectedNode.group)}15`,
                color: getNodeColor(selectedNode.group),
                border: `1px solid ${getNodeColor(selectedNode.group)}40`
              }}>
                {selectedNode.group}
              </span>
              <button 
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <h5 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 10px 0', color: '#FFF' }}>
              {selectedNode.label}
            </h5>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(selectedNode.properties || {}).map(([key, val]) => {
                if (key === 'id' || key === 'name') return null;
                return (
                  <div key={key} style={{
                    fontSize: '12px',
                    padding: '8px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', textTransform: 'capitalize', fontSize: '10px', fontWeight: 600 }}>
                      {key.replace('_', ' ')}
                    </span>
                    <span style={{ color: '#FFF', display: 'block', marginTop: '2px', wordBreak: 'break-word' }}>
                      {String(val)}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '12px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              paddingTop: '8px'
            }}>
              ID: {selectedNode.id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

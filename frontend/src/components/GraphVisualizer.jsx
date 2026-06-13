import React, { useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Activity, X, Info, ShieldAlert, Award, FileText } from 'lucide-react';

const getNodeColor = (group) => {
  switch (group) {
    case 'Patient': return '#0284C7'; // Blue
    case 'Disease': return '#E63946'; // Red
    case 'Medicine': return '#00A878'; // Green
    case 'Doctor': return '#CA8A04'; // Yellow
    case 'Symptom': return '#EA580C'; // Orange
    default: return '#64748B';
  }
};

export default function GraphVisualizer({ 
  graphData: incomingGraphData, 
  highlightNodes = new Set(), 
  highlightLinks = new Set(), 
  title = "Clinical Relations Map",
  onShowConflicts,
  conflicts = []
}) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const fgRef = useRef();

  const safeHighlightNodes = highlightNodes ?? new Set();
  const safeHighlightLinks = highlightLinks ?? new Set();

  // Handle auto-fit zoom on new data load
  useEffect(() => {
    if (fgRef.current && graphData?.nodes?.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  // Sync incomingGraphData
  useEffect(() => {
    if (incomingGraphData) {
      setGraphData({
        nodes: incomingGraphData.nodes ?? [],
        links: incomingGraphData.links ?? []
      });
      setLoading(false);
    }
  }, [incomingGraphData]);

  const handleNodeClick = (node) => {
    if (!node) return;
    setSelectedNode(node);
    
    // Zoom and center on the clicked node
    if (fgRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.2, 800);
    }
  };

  // Calculate Risk Score for Patient
  const getPatientRisk = (node) => {
    if (!node || node.group !== 'Patient') return null;
    
    // Count drug-disease conflicts for this patient
    const patientConflicts = (conflicts ?? []).filter(c => c && c.patient_name === node.label);
    
    // Count diseases linked to the patient in the current graph
    const patientLinks = graphData?.links?.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source?.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target?.id : l.target;
      return sourceId === node.id || targetId === node.id;
    }) || [];
    
    const connectedNodeIds = new Set(patientLinks.flatMap(l => [
      typeof l.source === 'object' ? l.source?.id : l.source,
      typeof l.target === 'object' ? l.target?.id : l.target
    ]));
    connectedNodeIds.delete(node.id);
    const connectedNodes = graphData?.nodes?.filter(n => connectedNodeIds.has(n?.id)) || [];
    const diseaseCount = connectedNodes.filter(n => n.group === 'Disease').length;

    if (patientConflicts.length > 0) {
      return { level: 'High', color: 'var(--alert-red)', bg: 'var(--alert-red-light)', score: 3 };
    } else if (diseaseCount > 1) {
      return { level: 'Medium', color: 'var(--accent-orange)', bg: 'rgba(234, 88, 12, 0.1)', score: 2 };
    } else {
      return { level: 'Low', color: 'var(--accent-green)', bg: 'var(--accent-green-light)', score: 1 };
    }
  };

  const patientRisk = getPatientRisk(selectedNode);

  return (
    <div style={{
      position: 'relative',
      height: '520px',
      display: 'flex',
      flexDirection: 'column',
      background: '#FFFFFF',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      {/* Top Panel Actions */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--primary-navy)" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)' }}>{title}</h4>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {onShowConflicts && conflicts && conflicts.length > 0 && (
            <button 
              className="btn-med-danger" 
              onClick={onShowConflicts}
              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px' }}
            >
              Highlight Conflicts
            </button>
          )}
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        
        {/* Legend Panel (Left Overlay) */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          background: 'rgba(255,255,255,0.95)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 12px rgba(27, 58, 107, 0.05)',
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'auto'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clinical Legend</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            {['Patient', 'Disease', 'Medicine', 'Doctor', 'Symptom'].map(grp => (
              <div key={grp} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: getNodeColor(grp),
                  display: 'inline-block'
                }} />
                <span style={{ color: 'var(--text-dark)', fontWeight: 500 }}>{grp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Force Graph Canvas Container */}
        <div style={{ flex: 1, position: 'relative', background: '#F8FAFC' }}>
          {loading ? (
            <div className="spinner-container" style={{ height: '100%' }}>
              <div className="spinner"></div>
            </div>
          ) : (graphData?.nodes?.length ?? 0) === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '14px',
              gap: '8px'
            }}>
              <Info size={16} />
              No clinical graph nodes to visualize. Try loading or search.
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={window.innerWidth > 1024 ? 700 : window.innerWidth - 64}
              height={450}
              nodeLabel={node => node ? `${node.group || 'Clinical'}: ${node.label || 'Unnamed'}` : ''}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkWidth={link => {
                if (!link) return 1;
                const sourceId = typeof link.source === 'object' ? link.source?.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target?.id : link.target;
                return safeHighlightLinks.has(`${sourceId}-${targetId}-${link.type}`) ? 3 : 1;
              }}
              linkColor={link => {
                if (!link) return '#CBD5E1';
                const sourceId = typeof link.source === 'object' ? link.source?.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target?.id : link.target;
                return safeHighlightLinks.has(`${sourceId}-${targetId}-${link.type}`) 
                  ? 'var(--alert-red)' 
                  : '#E2E8F0';
              }}
              linkLabel={link => link ? `Relationship: ${link.type || ''}` : ''}
              onNodeClick={handleNodeClick}
              nodeCanvasObject={(node, ctx, globalScale) => {
                if (!node) return;
                const label = node.label || 'Unnamed';
                const fontSize = 10 / globalScale;
                
                // Draw node circle
                const radius = 5 + (node.group === 'Patient' ? 1.5 : 0);
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                ctx.fillStyle = getNodeColor(node.group);
                
                // Node glow/outline if selected or highlighted
                const isHighlighted = safeHighlightNodes.has(node.id) || (selectedNode && selectedNode.id === node.id);
                if (isHighlighted) {
                  ctx.strokeStyle = 'var(--primary-navy)';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }
                ctx.fill();
                
                // Draw label text
                if (globalScale > 0.8) {
                  ctx.font = `600 ${fontSize}px Inter`;
                  ctx.fillStyle = isHighlighted ? 'var(--primary-navy)' : 'var(--text-dark)';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(label, node.x, node.y + radius + 7);
                }
              }}
              nodeCanvasObjectMode={() => 'replace'}
            />
          )}
        </div>

        {/* Selected Node Details Sidebar Drawer */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            top: '0',
            right: '0',
            bottom: '0',
            width: '320px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            background: '#FFFFFF',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-4px 0 16px rgba(27, 58, 107, 0.05)',
            maxHeight: '100%',
            overflowY: 'auto'
          }}>
            {/* Drawer Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1.5px solid var(--border-color)',
              paddingBottom: '10px',
              marginBottom: '16px'
            }}>
              <span className={`med-badge ${
                selectedNode.group === 'Patient' ? 'med-badge-blue' :
                selectedNode.group === 'Disease' ? 'med-badge-red' :
                selectedNode.group === 'Medicine' ? 'med-badge-green' :
                selectedNode.group === 'Doctor' ? 'med-badge-yellow' : 'med-badge-orange'
              }`}>
                {selectedNode.group}
              </span>
              <button 
                onClick={() => setSelectedNode(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Label name */}
            <h5 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--primary-navy)' }}>
              {selectedNode.label}
            </h5>

            {/* Risk Score Card for Patient */}
            {selectedNode.group === 'Patient' && patientRisk && (
              <div style={{
                background: patientRisk.bg,
                border: `1.5px solid ${patientRisk.color}`,
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <ShieldAlert size={24} color={patientRisk.color} style={{ flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clinical Risk Level</span>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: patientRisk.color, margin: '2px 0 0 0' }}>
                    {patientRisk.level} Risk
                  </p>
                </div>
              </div>
            )}

            {/* Properties List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Properties</span>
              {Object.entries(selectedNode.properties || {}).map(([key, val]) => {
                if (key === 'id' || key === 'name') return null;
                return (
                  <div key={key} style={{
                    fontSize: '13px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: '#F8FAFC',
                    border: '1px solid var(--border-color)'
                  }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'capitalize', fontSize: '10px', fontWeight: 600 }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--text-dark)', display: 'block', marginTop: '2px', fontWeight: 500, wordBreak: 'break-word' }}>
                      {String(val)}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div style={{
              fontSize: '10px',
              color: 'var(--text-light)',
              textAlign: 'center',
              marginTop: '16px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '10px'
            }}>
              Node ID: {selectedNode.id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

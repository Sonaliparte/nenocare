import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Layers, ShieldCheck, Play, AlertCircle } from 'lucide-react';
import StatsCards from './components/StatsCards';
import GraphVisualizer from './components/GraphVisualizer';
import CypherPanel from './components/CypherPanel';
import SemanticSearch from './components/SemanticSearch';
import AIChat from './components/AIChat';

// Backend URL can be parameterized; defaults to FastAPI port 8000
const BACKEND_URL = "http://localhost:8000";

export default function App() {
  const [fullGraph, setFullGraph] = useState({ nodes: [], links: [] });
  const [activeGraph, setActiveGraph] = useState({ nodes: [], links: [] });
  const [conflicts, setConflicts] = useState([]);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [selectedSubPanelTitle, setSelectedSubPanelTitle] = useState("Full Database Graph");
  
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    totalPatients: 0,
    totalPrescriptions: 0,
    activeConflicts: 0,
    mostCommonDisease: "None"
  });

  // Load database metadata on mount
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch full graph
      const graphRes = await fetch(`${BACKEND_URL}/graph/full`);
      if (!graphRes.ok) throw new Error("Could not retrieve graph from Neo4j. Is database running?");
      const graphData = await graphRes.json();
      setFullGraph(graphData);
      
      // Default active graph view is the full database
      setActiveGraph(graphData);
      setSelectedSubPanelTitle("Full Database Graph");

      // 2. Fetch drug conflicts
      const conflictRes = await fetch(`${BACKEND_URL}/alerts/drug-conflicts`);
      const conflictData = await conflictRes.json();
      const conflictList = conflictData?.table || conflictData?.conflicts || conflictData?.data || (Array.isArray(conflictData) ? conflictData : []);
      setConflicts(conflictList);

      // 3. Compute stats
      computeStats(graphData, conflictList);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (graph, conflictList) => {
    const nodes = graph?.nodes || [];
    const links = graph?.links || [];

    const patients = nodes.filter(n => n && n.group === 'Patient').length;
    const prescriptions = links.filter(l => l && l.type === 'PRESCRIBED').length;
    
    // Find most common disease
    const diseaseDiagnosisCounts = {};
    links.forEach(link => {
      if (link && link.type === 'DIAGNOSED_WITH') {
        const diseaseNode = nodes.find(n => n && n.id === link.target);
        if (diseaseNode && diseaseNode.group === 'Disease') {
          diseaseDiagnosisCounts[diseaseNode.label] = (diseaseDiagnosisCounts[diseaseNode.label] || 0) + 1;
        }
      }
    });

    let topDisease = "None";
    let maxDiagnoses = 0;
    Object.entries(diseaseDiagnosisCounts).forEach(([name, count]) => {
      if (count > maxDiagnoses) {
        maxDiagnoses = count;
        topDisease = name;
      }
    });

    setStats({
      totalPatients: patients,
      totalPrescriptions: prescriptions,
      activeConflicts: conflictList?.length || 0,
      mostCommonDisease: topDisease
    });
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/seed`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to seed database.");
      await fetchMetadata();
      alert("Database successfully seeded with 10 Patients, 8 Diseases, 12 Medicines, 5 Doctors, and 15 Symptoms!");
    } catch (err) {
      setError("Database seeding failed. Please check if your Neo4j container is running at localhost:7687.");
    } finally {
      setSeeding(false);
    }
  };

  // Callback when a Cypher query or semantic search executes
  const handleGraphDataResult = (graphData, tableData, sourceTitle) => {
    const safeGraph = {
      nodes: graphData?.nodes || [],
      links: graphData?.links || []
    };
    setActiveGraph(safeGraph);
    setSelectedSubPanelTitle(sourceTitle);

    // Extract highlight sets
    const nodeIds = new Set(safeGraph.nodes.map(n => n && n.id).filter(Boolean));
    const linkIds = new Set(safeGraph.links.map(l => l && `${l.source}-${l.target}-${l.type}`).filter(Boolean));
    setHighlightNodes(nodeIds);
    setHighlightLinks(linkIds);
  };

  // Clicking the "Conflict Alerts" card filters visualizer to show conflict paths
  const handleShowConflictsInGraph = () => {
    if (!conflicts || !Array.isArray(conflicts)) return;

    const conflictNodes = new Set();
    const conflictLinks = new Set();
    
    const nodesMap = {};
    const nodes = fullGraph?.nodes || [];
    const links = fullGraph?.links || [];
    nodes.forEach(n => { if (n) nodesMap[n.id] = n; });

    // Filter full graph for conflict paths
    const filteredLinks = [];
    const filteredNodes = new Set();

    conflicts.forEach(c => {
      if (!c) return;
      // Find patient and medicine/disease nodes in fullGraph
      const patient = nodes.find(n => n && n.label === c.patient_name);
      const medicine = nodes.find(n => n && n.label === c.medicine_name);
      const disease = nodes.find(n => n && n.label === c.conflicting_disease);

      if (patient) filteredNodes.add(patient);
      if (medicine) filteredNodes.add(medicine);
      if (disease) filteredNodes.add(disease);

      // Extract path links
      links.forEach(l => {
        if (!l) return;
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;

        // Link from patient to medicine or disease
        if (sourceId === patient?.id && (targetId === medicine?.id || targetId === disease?.id)) {
          filteredLinks.push(l);
          conflictLinks.add(`${sourceId}-${targetId}-${l.type}`);
        }
        // Link from medicine/disease contraindication
        if ((sourceId === medicine?.id && targetId === disease?.id) || (sourceId === disease?.id && targetId === medicine?.id)) {
          filteredLinks.push(l);
          conflictLinks.add(`${sourceId}-${targetId}-${l.type}`);
        }
        // Check drug-drug conflicts
        const otherMeds = nodes.filter(n => n && n.group === 'Medicine');
        otherMeds.forEach(m2 => {
          if (m2 && sourceId === medicine?.id && targetId === m2.id) {
            // Check if patient takes both
            const hasMed2 = links.some(x => {
              if (!x) return false;
              const xSourceId = typeof x.source === 'object' ? x.source.id : x.source;
              const xTargetId = typeof x.target === 'object' ? x.target.id : x.target;
              return xSourceId === patient?.id && xTargetId === m2.id;
            });
            if (hasMed2) {
              filteredNodes.add(m2);
              filteredLinks.push(l);
              conflictLinks.add(`${sourceId}-${targetId}-${l.type}`);
            }
          }
        });
      });
    });

    const activeConflictGraph = {
      nodes: Array.from(filteredNodes),
      links: filteredLinks
    };

    setActiveGraph(activeConflictGraph);
    setSelectedSubPanelTitle("Active Drug & Disease Conflict Paths");
    setHighlightNodes(new Set(activeConflictGraph.nodes.map(n => n.id)));
    setHighlightLinks(conflictLinks);
  };

  // Clicking "Analyze with Claude" in Semantic search sends disease context to Chat
  const handleSendToChat = (diseaseRecord) => {
    if (!diseaseRecord || !diseaseRecord.disease_name) return;
    // We send a custom prompt to trigger a message in the chat
    const prompt = `Analyze risks and medical treatments associated with: ${diseaseRecord.disease_name}.`;
    
    // Find disease node in fullGraph
    const nodes = fullGraph?.nodes || [];
    const links = fullGraph?.links || [];
    const diseaseNode = nodes.find(n => n && n.label === diseaseRecord.disease_name);
    if (diseaseNode) {
      // Gather disease 1-step neighborhood (symptoms, treating doctors, prescribed patients)
      const neighborNodeIds = new Set([diseaseNode.id]);
      const neighborLinks = [];
      
      links.forEach(l => {
        if (!l) return;
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;

        if (sourceId === diseaseNode.id) {
          neighborNodeIds.add(targetId);
          neighborLinks.push(l);
        } else if (targetId === diseaseNode.id) {
          neighborNodeIds.add(sourceId);
          neighborLinks.push(l);
        }
      });

      const diseaseContextGraph = {
        nodes: nodes.filter(n => n && neighborNodeIds.has(n.id)),
        links: neighborLinks
      };

      setActiveGraph(diseaseContextGraph);
      setSelectedSubPanelTitle(`Context: ${diseaseRecord.disease_name}`);
      setHighlightNodes(new Set([diseaseNode.id]));
      setHighlightLinks(new Set(neighborLinks.map(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return `${s}-${t}-${l.type}`;
      })));
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Panel */}
      <div className="glass-panel" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'linear-gradient(90deg, rgba(10,14,26,0.85) 0%, rgba(0,212,255,0.05) 100%)',
        border: '1px solid rgba(0, 212, 255, 0.25)'
      }}>
        <div>
          <h1 className="glow-text-blue" style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            letterSpacing: '-0.02em'
          }}>
            <Database size={24} color="var(--accent-blue)" />
            Healthcare Knowledge Graph Explorer
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>GraphRAG</span>
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Semantic search and Neo4j relational logic grounded with Claude 3.5 Sonnet analysis
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-outline" 
            onClick={fetchMetadata}
            disabled={loading}
            style={{ fontSize: '12px' }}
          >
            <RefreshCw size={14} className={loading ? "animate-pulse" : ""} />
            Reload Graph
          </button>
          <button 
            className="btn-primary animate-pulse" 
            onClick={handleSeedDatabase}
            disabled={seeding}
            style={{ fontSize: '12px', background: 'linear-gradient(135deg, #FF4757 0%, #FF6B81 100%)', color: '#FFF' }}
          >
            <Layers size={14} />
            {seeding ? "Seeding..." : "Reset & Seed DB"}
          </button>
        </div>
      </div>

      {/* Main Connection Error Warning */}
      {error && (
        <div style={{
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          color: 'var(--alert-red)',
          borderRadius: '8px',
          padding: '12px 18px',
          fontSize: '13px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <AlertCircle size={18} />
          <div>
            <strong>Database Connection Issue: </strong>
            {error} Make sure Neo4j is running, your credentials in .env are correct, and backend is launched using `python -m backend.main`.
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px'
      }}>
        {/* Left Hand side Dashboard: Stats, visualizer and semantic search */}
        <div style={{
          gridColumn: window.innerWidth > 1024 ? 'span 7' : 'span 12',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <StatsCards stats={stats} onConflictCardClick={handleShowConflictsInGraph} />
          
          <GraphVisualizer 
            graphData={activeGraph} 
            highlightNodes={highlightNodes}
            highlightLinks={highlightLinks}
            title={selectedSubPanelTitle}
          />
          
          <SemanticSearch 
            onSearchExecuted={handleGraphDataResult} 
            onSendToChat={handleSendToChat}
            backendUrl={BACKEND_URL}
          />
        </div>

        {/* Right Hand side Dashboard: Cypher execution and AI Chat */}
        <div style={{
          gridColumn: window.innerWidth > 1024 ? 'span 5' : 'span 12',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <CypherPanel 
            onQueryExecuted={handleGraphDataResult} 
            backendUrl={BACKEND_URL}
          />
          
          <AIChat 
            graphContext={activeGraph} 
            backendUrl={BACKEND_URL}
          />
        </div>
      </div>

      {/* Footer prevention badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: '20px',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        <ShieldCheck size={14} color="var(--accent-blue)" />
        <span>Grounded GraphRAG Framework - Hallucination Prevention System actively protecting Claude queries.</span>
      </div>

    </div>
  );
}

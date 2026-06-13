import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Layers, ShieldCheck, Activity, Search, Code, MessageSquare, AlertCircle, FileText } from 'lucide-react';
import StatsCards from './components/StatsCards';
import GraphVisualizer from './components/GraphVisualizer';
import CypherPanel from './components/CypherPanel';
import SemanticSearch from './components/SemanticSearch';
import AIChat from './components/AIChat';
import './App.css';

const BACKEND_URL = "http://localhost:8000";

export default function App() {
  const [fullGraph, setFullGraph] = useState({ nodes: [], links: [] });
  const [activeGraph, setActiveGraph] = useState({ nodes: [], links: [] });
  const [conflicts, setConflicts] = useState([]);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [selectedSubPanelTitle, setSelectedSubPanelTitle] = useState("Full Database Graph");
  const [activeTab, setActiveTab] = useState("graph"); // "graph", "search", "queries", "chat"
  
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
      const safeGraphData = {
        nodes: graphData?.nodes ?? [],
        links: graphData?.links ?? []
      };
      setFullGraph(safeGraphData);
      
      // Default active graph view is the full database
      setActiveGraph(safeGraphData);
      setSelectedSubPanelTitle("Full Database Graph");

      // 2. Fetch drug conflicts
      const conflictRes = await fetch(`${BACKEND_URL}/alerts/drug-conflicts`);
      if (!conflictRes.ok) throw new Error("Could not retrieve conflicts.");
      const conflictData = await conflictRes.json();
      const conflictList = conflictData?.table || conflictData?.conflicts || conflictData?.data?.conflicts || conflictData?.data || (Array.isArray(conflictData) ? conflictData : []);
      setConflicts(conflictList);

      // 3. Compute stats
      computeStats(safeGraphData, conflictList);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const computeStats = (graph, conflictList) => {
    const nodes = graph?.nodes ?? [];
    const links = graph?.links ?? [];
    const safeConflicts = conflictList ?? [];

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
      activeConflicts: safeConflicts.length,
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
      nodes: graphData?.nodes ?? [],
      links: graphData?.links ?? []
    };
    setActiveGraph(safeGraph);
    setSelectedSubPanelTitle(sourceTitle);

    // Extract highlight sets
    const nodeIds = new Set(safeGraph.nodes.map(n => n?.id).filter(Boolean));
    const linkIds = new Set(safeGraph.links.map(l => l && `${l.source}-${l.target}-${l.type}`).filter(Boolean));
    setHighlightNodes(nodeIds);
    setHighlightLinks(linkIds);
    
    // Auto shift to Graph tab to show results
    setActiveTab("graph");
  };

  // Clicking the "Conflict Alerts" card filters visualizer to show conflict paths
  const handleShowConflictsInGraph = () => {
    if (!conflicts || !Array.isArray(conflicts)) return;

    const conflictNodes = new Set();
    const conflictLinks = new Set();
    
    const nodesMap = {};
    const nodes = fullGraph?.nodes ?? [];
    const links = fullGraph?.links ?? [];
    nodes.forEach(n => { if (n && n.id) nodesMap[n.id] = n; });

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
        const sourceId = typeof l.source === 'object' ? l.source?.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target?.id : l.target;

        if (sourceId && targetId) {
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
                const xSourceId = typeof x.source === 'object' ? x.source?.id : x.source;
                const xTargetId = typeof x.target === 'object' ? x.target?.id : x.target;
                return xSourceId === patient?.id && xTargetId === m2.id;
              });
              if (hasMed2) {
                filteredNodes.add(m2);
                filteredLinks.push(l);
                conflictLinks.add(`${sourceId}-${targetId}-${l.type}`);
              }
            }
          });
        }
      });
    });

    const activeConflictGraph = {
      nodes: Array.from(filteredNodes).filter(Boolean),
      links: filteredLinks.filter(Boolean)
    };

    setActiveGraph(activeConflictGraph);
    setSelectedSubPanelTitle("Active Drug & Disease Conflict Paths");
    setHighlightNodes(new Set(activeConflictGraph.nodes.map(n => n?.id).filter(Boolean)));
    setHighlightLinks(conflictLinks);
    
    // Switch to Graph tab to visualize
    setActiveTab("graph");
  };

  // Clicking "Analyze with Claude" in Semantic search sends disease context to Chat
  const handleSendToChat = (diseaseRecord) => {
    if (!diseaseRecord || !diseaseRecord.disease_name) return;
    
    // Find disease node in fullGraph
    const nodes = fullGraph?.nodes ?? [];
    const links = fullGraph?.links ?? [];
    const diseaseNode = nodes.find(n => n && n.label === diseaseRecord.disease_name);
    if (diseaseNode) {
      // Gather disease 1-step neighborhood (symptoms, treating doctors, prescribed patients)
      const neighborNodeIds = new Set([diseaseNode.id]);
      const neighborLinks = [];
      
      links.forEach(l => {
        if (!l) return;
        const sourceId = typeof l.source === 'object' ? l.source?.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target?.id : l.target;

        if (sourceId === diseaseNode.id) {
          if (targetId) neighborNodeIds.add(targetId);
          neighborLinks.push(l);
        } else if (targetId === diseaseNode.id) {
          if (sourceId) neighborNodeIds.add(sourceId);
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
        const s = typeof l.source === 'object' ? l.source?.id : l.source;
        const t = typeof l.target === 'object' ? l.target?.id : l.target;
        return `${s}-${t}-${l.type}`;
      }).filter(Boolean)));
      
      // Auto shift to AI Assistant
      setActiveTab("chat");
    }
  };

  const handleExportReport = () => {
    let reportText = `NENOCARE HEALTHCARE CLINICAL STATUS REPORT\n`;
    reportText += `Generated on: ${new Date().toLocaleString()}\n`;
    reportText += `=========================================================\n\n`;
    
    reportText += `DATABASE STATS:\n`;
    reportText += `- Total Patients: ${stats.totalPatients}\n`;
    reportText += `- Total Prescriptions: ${stats.totalPrescriptions}\n`;
    reportText += `- Active Drug Conflicts: ${stats.activeConflicts}\n`;
    reportText += `- Most Common Disease: ${stats.mostCommonDisease}\n\n`;
    
    reportText += `=========================================================\n`;
    reportText += `ACTIVE DRUG & DISEASE CONFLICTS DETAILS:\n`;
    if (conflicts && conflicts.length > 0) {
      conflicts.forEach((c, idx) => {
        reportText += `\nConflict Alert #${idx + 1}:\n`;
        reportText += `  - Patient Name: ${c.patient_name}\n`;
        reportText += `  - Medicine Prescribed: ${c.medicine_name}\n`;
        reportText += `  - Conflicting Disease Diagnosed: ${c.conflicting_disease}\n`;
      });
    } else {
      reportText += `No active drug/disease conflicts detected in the system.\n`;
    }
    reportText += `\n=========================================================\n`;
    reportText += `Grounded GraphRAG Hallucination Prevention System Active.\n`;
    
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NenoCare_Clinical_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Hero Header Panel */}
      <div className="medical-card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px',
        flexWrap: 'wrap',
        gap: '16px',
        borderLeft: '5px solid var(--primary-navy)',
        background: '#FFFFFF'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--primary-navy)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            <Database size={28} color="var(--primary-navy)" />
            NenoCare GraphRAG
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              color: 'var(--accent-green)', 
              padding: '3px 10px', 
              background: 'var(--accent-green-light)', 
              borderRadius: '99px',
              border: '1px solid rgba(0, 168, 120, 0.15)'
            }}>
              Clinical Explorer
            </span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
            AI-Powered Patient Knowledge Graph & Safe Grounded Reasoning Engine
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn-med-outline" 
            onClick={fetchMetadata}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-pulse" : ""} />
            Refresh
          </button>
          
          <button 
            className="btn-med-primary" 
            onClick={handleExportReport}
          >
            <FileText size={14} />
            Export Report
          </button>
          
          <button 
            className="btn-med-danger" 
            onClick={handleSeedDatabase}
            disabled={seeding}
          >
            <Layers size={14} />
            {seeding ? "Rebuilding..." : "Reset Database"}
          </button>
        </div>
      </div>

      {/* Main Connection Error Warning */}
      {error && (
        <div style={{
          background: 'var(--alert-red-light)',
          border: '1.5px solid var(--alert-red)',
          color: 'var(--alert-red)',
          borderRadius: '10px',
          padding: '14px 20px',
          fontSize: '14px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          fontWeight: 500
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Database Connection Error: </strong>
            {error} Ensure Neo4j is running, your environment credentials are correct, and the backend service is active.
          </div>
        </div>
      )}

      {/* Live Drug Conflict Alert Banner */}
      {stats.activeConflicts > 0 && (
        <div className="alert-banner" onClick={handleShowConflictsInGraph}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <span>⚠️ {stats.activeConflicts} Drug Conflicts Detected in Database — Click to View conflict paths in graph</span>
          </div>
          <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>Analyze Now</span>
        </div>
      )}

      {/* Hero Stats Panel */}
      <StatsCards stats={stats} onConflictCardClick={handleShowConflictsInGraph} />

      {/* Main Navigation Tabs */}
      <div className="tab-container">
        <button 
          className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          <Activity size={16} />
          Knowledge Graph
        </button>
        <button 
          className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={16} />
          Patient Search
        </button>
        <button 
          className={`tab-btn ${activeTab === 'queries' ? 'active' : ''}`}
          onClick={() => setActiveTab('queries')}
        >
          <Code size={16} />
          Clinical Queries
        </button>
        <button 
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} />
          AI Assistant
        </button>
      </div>

      {/* Tab Contents */}
      <div style={{ minHeight: '520px' }}>
        {activeTab === 'graph' && (
          <div className="medical-card" style={{ padding: '0', overflow: 'hidden' }}>
            <GraphVisualizer 
              graphData={activeGraph} 
              highlightNodes={highlightNodes}
              highlightLinks={highlightLinks}
              title={selectedSubPanelTitle}
              onShowConflicts={handleShowConflictsInGraph}
              conflicts={conflicts}
            />
          </div>
        )}

        {activeTab === 'search' && (
          <SemanticSearch 
            onSearchExecuted={handleGraphDataResult} 
            onSendToChat={handleSendToChat}
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'queries' && (
          <CypherPanel 
            onQueryExecuted={handleGraphDataResult} 
            backendUrl={BACKEND_URL}
          />
        )}

        {activeTab === 'chat' && (
          <AIChat 
            graphContext={activeGraph} 
            backendUrl={BACKEND_URL}
            onQuerySuggestion={handleGraphDataResult}
          />
        )}
      </div>

      {/* Safety Hallucination Prevention Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '20px 0',
        borderTop: '1px solid var(--border-color)',
        marginTop: '24px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        fontWeight: 500
      }}>
        <ShieldCheck size={16} color="var(--accent-green)" />
        <span>Grounded GraphRAG Hallucination Prevention System Active. All analysis is verified against verified patient nodes.</span>
      </div>

    </div>
  );
}

import React, { useState } from 'react';
import { Play, Code, Database, Table, AlertCircle, AlertTriangle, User, FileText, Users, Link } from 'lucide-react';

const PREBUILT_QUERIES = [
  {
    id: 1,
    title: "Drug Conflict Detection",
    icon: <AlertTriangle size={20} color="var(--alert-red)" />,
    description: "Audit the database to detect patients prescribed a drug that is contraindicated with their diagnosed disease.",
    cypher: `MATCH path1 = (p:Patient)-[:PRESCRIBED]->(m:Medicine)
WHERE m.name = $medicineName
WITH p, m, path1
MATCH path2 = (p)-[:DIAGNOSED_WITH]->(d:Disease)<-[:CONTRAINDICATED_WITH*1..2]-(m)
RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS conflicting_disease, path1, path2`,
    defaultParams: { medicineName: "Ibuprofen" },
    paramLabel: "Contraindicated Medicine"
  },
  {
    id: 2,
    title: "Patient Clinical History",
    icon: <User size={20} color="var(--accent-blue)" />,
    description: "Retrieve complete diagnostic history, symptom pathway, and drug profiles for patients of a specific disease.",
    cypher: `MATCH path1 = (p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)
WHERE d.name = $diseaseName
WITH p, d, path1
MATCH path2 = (p)-[:PRESCRIBED]->(m:Medicine)
RETURN p.name AS patient_name, p.age AS patient_age, collect(DISTINCT m.name) AS medicines, collect(DISTINCT d.name) AS diseases, collect(path1) AS paths1, collect(path2) AS paths2`,
    defaultParams: { diseaseName: "Diabetes Mellitus Type 2" },
    paramLabel: "Disease Diagnosis"
  },
  {
    id: 3,
    title: "Medicine Network",
    icon: <FileText size={20} color="var(--accent-green)" />,
    description: "Trace the clinical network linking patient prescriptions, dosages, and target diseases.",
    cypher: `MATCH path = (p:Patient)-[r:PRESCRIBED]->(m:Medicine)-[:TREATS]->(d:Disease)
RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS disease_name, r.dosage AS dosage, path
ORDER BY m.name`,
    defaultParams: {},
    paramLabel: null
  },
  {
    id: 4,
    title: "Doctor Workload",
    icon: <Users size={20} color="var(--accent-yellow)" />,
    description: "Measure clinical workloads by aggregating patients and unique conditions treated per doctor.",
    cypher: `MATCH path = (doc:Doctor)<-[:TREATED_BY]-(p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)
RETURN doc.name AS doctor_name, doc.specialization AS specialization, count(p) AS patient_count, collect(DISTINCT d.name) AS diseases_treated, collect(path) AS paths
ORDER BY patient_count DESC`,
    defaultParams: {},
    paramLabel: null
  },
  {
    id: 5,
    title: "Symptom Pathways",
    icon: <Link size={20} color="var(--accent-orange)" />,
    description: "Map and analyze the biological symptom pathways tracing from Patient to Disease to Symptoms.",
    cypher: `MATCH path = (p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)-[:HAS_SYMPTOM]->(s:Symptom)
RETURN p.name AS patient_name, d.name AS disease_name, collect(DISTINCT s.name) AS symptoms, collect(path) AS paths`,
    defaultParams: {},
    paramLabel: null
  }
];

export default function CypherPanel({ onQueryExecuted, backendUrl }) {
  const [selectedQueryId, setSelectedQueryId] = useState(1);
  const [paramValue, setParamValue] = useState("Ibuprofen");
  const [rawCypher, setRawCypher] = useState(PREBUILT_QUERIES[0].cypher);
  const [showDeveloperConsole, setShowDeveloperConsole] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectPrebuilt = (query) => {
    setSelectedQueryId(query.id);
    setRawCypher(query.cypher);
    
    // Set default param if exists
    if (query.paramLabel) {
      const firstKey = Object.keys(query.defaultParams)[0];
      setParamValue(query.defaultParams[firstKey]);
    } else {
      setParamValue("");
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setTableData([]);

    try {
      const activeQuery = PREBUILT_QUERIES.find(q => q.id === selectedQueryId);
      let params = {};
      
      if (activeQuery && activeQuery.paramLabel) {
        const firstKey = Object.keys(activeQuery.defaultParams)[0];
        params[firstKey] = paramValue.trim();
      }

      const response = await fetch(`${backendUrl}/query/cypher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: rawCypher,
          parameters: params
        })
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail?.detail || "Clinical query execution failed.");
      }

      const data = await response.json();
      const safeTable = data?.table ?? [];
      const safeGraph = {
        nodes: data?.graph?.nodes ?? [],
        links: data?.graph?.links ?? []
      };

      setTableData(safeTable);
      
      if (onQueryExecuted) {
        onQueryExecuted(safeGraph, safeTable, activeQuery ? activeQuery.title : "Clinical Query");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Query failed. Please verify credentials or database state.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunRaw = async () => {
    setLoading(true);
    setError(null);
    setTableData([]);
    setSelectedQueryId(null); // Deselect prebuilt

    try {
      const response = await fetch(`${backendUrl}/query/cypher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: rawCypher
        })
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail?.detail || "Custom Cypher command failed.");
      }

      const data = await response.json();
      const safeTable = data?.table ?? [];
      const safeGraph = {
        nodes: data?.graph?.nodes ?? [],
        links: data?.graph?.links ?? []
      };

      setTableData(safeTable);
      
      if (onQueryExecuted) {
        onQueryExecuted(safeGraph, safeTable, "Raw Console Query");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Custom Cypher failed.");
    } finally {
      setLoading(false);
    }
  };

  const currentQuery = PREBUILT_QUERIES.find(q => q.id === selectedQueryId);
  const tableHeaders = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <div className="medical-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: '#FFFFFF' }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={20} color="var(--primary-navy)" />
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)' }}>Pre-built Clinical Audits</h4>
        </div>
        <button 
          onClick={() => setShowDeveloperConsole(!showDeveloperConsole)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'underline'
          }}
        >
          {showDeveloperConsole ? "Hide Developer Console" : "Show Developer Console"}
        </button>
      </div>

      {/* Grid of Query Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
        {PREBUILT_QUERIES.map((q) => {
          const isActive = selectedQueryId === q.id;
          return (
            <div 
              key={q.id}
              onClick={() => handleSelectPrebuilt(q)}
              style={{
                border: isActive ? '2px solid var(--primary-navy)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '14px 16px',
                cursor: 'pointer',
                background: isActive ? '#F8FAFC' : '#FFFFFF',
                transition: 'all 0.2s ease',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{
                background: isActive ? '#FFFFFF' : '#F1F5F9',
                padding: '10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)'
              }}>
                {q.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary-navy)' }}>{q.title}</span>
                  {isActive && <span className="med-badge med-badge-blue" style={{ fontSize: '9px' }}>Selected</span>}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                  {q.description}
                </p>
                
                {/* Embedded parameters & run controls inside selected card */}
                {isActive && (
                  <div 
                    onClick={(e) => e.stopPropagation()} // Prevent card deselection
                    style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    {q.paramLabel ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>{q.paramLabel}:</span>
                        <input
                          type="text"
                          className="medical-input"
                          value={paramValue}
                          onChange={(e) => setParamValue(e.target.value)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            flex: 1
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}></div>
                    )}
                    
                    <button 
                      className="btn-med-primary" 
                      onClick={handleExecute}
                      disabled={loading}
                      style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                    >
                      <Play size={12} />
                      {loading ? "Running..." : "Run Audit"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Developer Console (Collapsible) */}
      {showDeveloperConsole && (
        <div style={{
          background: '#F8FAFC',
          padding: '16px',
          borderRadius: '8px',
          border: '1.5px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Advanced Query Developer Mode
          </span>
          <textarea
            className="medical-input"
            value={rawCypher}
            onChange={(e) => setRawCypher(e.target.value)}
            placeholder="MATCH (n) RETURN n LIMIT 10..."
            rows={5}
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              background: '#FFFFFF',
              color: 'var(--text-dark)'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn-med-outline" 
              onClick={handleRunRaw}
              disabled={loading}
              style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px' }}
            >
              <Code size={12} />
              {loading ? "Running..." : "Execute Raw Cypher"}
            </button>
          </div>
        </div>
      )}

      {/* Loaders and Errors */}
      {loading && tableData.length === 0 && (
        <div className="spinner-container">
          <div className="spinner"></div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'var(--alert-red-light)',
          border: '1.5px solid var(--alert-red)',
          color: 'var(--alert-red)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          fontWeight: 500
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabular Results Display */}
      {tableData.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
            <Table size={16} />
            <span>Audit Findings ({tableData.length} entries matched)</span>
          </div>
          
          <div className="med-table-container" style={{ maxHeight: '240px' }}>
            <table className="med-table">
              <thead>
                <tr>
                  {tableHeaders.map((header) => (
                    <th key={header}>{header.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx}>
                    {tableHeaders.map((header) => (
                      <td key={header} title={row && row[header] != null ? String(row[header]) : ''}>
                        {row && Array.isArray(row[header]) 
                          ? row[header].join(', ') 
                          : (row && row[header] != null ? String(row[header]) : '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

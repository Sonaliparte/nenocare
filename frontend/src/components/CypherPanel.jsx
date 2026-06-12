import React, { useState } from 'react';
import { Play, Code, Database, Table, AlertCircle } from 'lucide-react';

const PREBUILT_QUERIES = [
  {
    id: 1,
    title: "Drug-Disease Conflict",
    description: "Detects patients prescribed a drug contraindicated with their diagnosed disease.",
    cypher: `MATCH path1 = (p:Patient)-[:PRESCRIBED]->(m:Medicine)
WHERE m.name = $medicineName
WITH p, m, path1
MATCH path2 = (p)-[:DIAGNOSED_WITH]->(d:Disease)<-[:CONTRAINDICATED_WITH*1..2]-(m)
RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS conflicting_disease, path1, path2`,
    defaultParams: { medicineName: "Ibuprofen" },
    paramLabel: "Medicine Name"
  },
  {
    id: 2,
    title: "Complex Patient History",
    description: "Retrieves complete drug and disease profiles for patients diagnosed with a specific disease.",
    cypher: `MATCH path1 = (p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)
WHERE d.name = $diseaseName
WITH p, d, path1
MATCH path2 = (p)-[:PRESCRIBED]->(m:Medicine)
RETURN p.name AS patient_name, p.age AS patient_age, collect(DISTINCT m.name) AS medicines, collect(DISTINCT d.name) AS diseases, collect(path1) AS paths1, collect(path2) AS paths2`,
    defaultParams: { diseaseName: "Diabetes Mellitus Type 2" },
    paramLabel: "Disease Name"
  },
  {
    id: 3,
    title: "Medicine Network",
    description: "Traces the prescription grid linking Patients, Drugs, and Target Diseases.",
    cypher: `MATCH path = (p:Patient)-[r:PRESCRIBED]->(m:Medicine)-[:TREATS]->(d:Disease)
RETURN p.name AS patient_name, m.name AS medicine_name, d.name AS disease_name, r.dosage AS dosage, path
ORDER BY m.name`,
    defaultParams: {},
    paramLabel: null
  },
  {
    id: 4,
    title: "Doctor Patient Load",
    description: "Aggregates the volume of unique patients and range of conditions treated per Doctor.",
    cypher: `MATCH path = (doc:Doctor)<-[:TREATED_BY]-(p:Patient)-[:DIAGNOSED_WITH]->(d:Disease)
RETURN doc.name AS doctor_name, doc.specialization AS specialization, count(p) AS patient_count, collect(DISTINCT d.name) AS diseases_treated, collect(path) AS paths
ORDER BY patient_count DESC`,
    defaultParams: {},
    paramLabel: null
  },
  {
    id: 5,
    title: "Symptom Pathway",
    description: "Maps symptom sets tracing from Patient to Disease to specific Symptoms.",
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
        throw new Error(errDetail.detail || "Query execution failed.");
      }

      const data = await response.json();
      setTableData(data.table || []);
      
      if (onQueryExecuted) {
        onQueryExecuted(data.graph, data.table, `Pre-built Query ${selectedQueryId}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
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
        throw new Error(errDetail.detail || "Query execution failed.");
      }

      const data = await response.json();
      setTableData(data.table || []);
      
      if (onQueryExecuted) {
        onQueryExecuted(data.graph, data.table, "Raw Cypher Query");
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentQuery = PREBUILT_QUERIES.find(q => q.id === selectedQueryId);
  const tableHeaders = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <Database size={18} color="var(--accent-blue)" />
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFF' }}>Cypher Query Console</h4>
      </div>

      {/* Pre-built Selector Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {PREBUILT_QUERIES.map((q) => (
          <button
            key={q.id}
            onClick={() => handleSelectPrebuilt(q)}
            style={{
              padding: '8px 4px',
              borderRadius: '6px',
              border: selectedQueryId === q.id ? '1px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.05)',
              background: selectedQueryId === q.id ? 'rgba(0, 212, 255, 0.1)' : 'rgba(5, 8, 17, 0.4)',
              color: selectedQueryId === q.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'all 0.2s ease'
            }}
            title={q.title}
          >
            Q{q.id}: {q.title.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Query Detail & Parameter */}
      {currentQuery && (
        <div style={{
          background: 'rgba(5, 8, 17, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '12px'
        }}>
          <p style={{ color: '#FFF', fontWeight: 600, marginBottom: '4px' }}>{currentQuery.title}</p>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{currentQuery.description}</p>
          
          {currentQuery.paramLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{currentQuery.paramLabel}:</span>
              <input
                type="text"
                className="input-text"
                value={paramValue}
                onChange={(e) => {
                  setParamValue(e.target.value);
                  // Update parameter values inside rawCypher too for display purposes
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  flex: '1',
                  maxWidth: '200px'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Editor & Execution Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <textarea
          className="cypher-console"
          value={rawCypher}
          onChange={(e) => setRawCypher(e.target.value)}
          placeholder="MATCH (n) RETURN n LIMIT 10..."
          rows={5}
        />
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {selectedQueryId && (
            <button 
              className="btn-primary" 
              onClick={handleExecute}
              disabled={loading}
              style={{ fontSize: '12px', padding: '8px 14px' }}
            >
              <Play size={14} />
              {loading ? "Running..." : "Run Pre-built"}
            </button>
          )}
          <button 
            className="btn-outline" 
            onClick={handleRunRaw}
            disabled={loading}
            style={{ fontSize: '12px', padding: '8px 14px' }}
          >
            <Code size={14} />
            {loading ? "Running..." : "Run Raw Console"}
          </button>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div style={{
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.2)',
          color: 'var(--alert-red)',
          borderRadius: '6px',
          padding: '10px 12px',
          fontSize: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabular Results */}
      <div style={{ flex: 1, minHeight: '150px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          <Table size={14} />
          <span>Results Table ({tableData.length} rows)</span>
        </div>
        
        <div className="results-table-container" style={{ flex: 1, background: '#05070c', maxHeight: '180px' }}>
          {tableData.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: '100px',
              color: 'var(--text-muted)',
              fontSize: '12px'
            }}>
              No results to display. Run query.
            </div>
          ) : (
            <table className="results-table">
              <thead>
                <tr>
                  {tableHeaders.map((header) => (
                    <th key={header}>{header.replace('_', ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => (
                  <tr key={idx}>
                    {tableHeaders.map((header) => (
                      <td key={header} title={String(row[header])}>
                        {Array.isArray(row[header]) 
                          ? row[header].join(', ') 
                          : String(row[header])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

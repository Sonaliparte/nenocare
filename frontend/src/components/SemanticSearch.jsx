import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Pin, Send, ShieldAlert, Heart, Calendar } from 'lucide-react';

const SUGGESTIONS = [
  "frequent urination and excessive thirst",
  "chest pain and breathing difficulties",
  "joint pain and knee stiffness",
  "severe throbbing headache and nausea"
];

export default function SemanticSearch({ onSearchExecuted, onSendToChat, backendUrl }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [graphContext, setGraphContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Feature 5 - Debounced Live Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setGraphContext(null);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 450); // 450ms debounce time

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async (queryText) => {
    const q = queryText || searchQuery;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${backendUrl}/search/vector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          limit: 3
        })
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail?.detail || "Vector search query failed.");
      }

      const data = await response.json();
      const safeTable = data?.table ?? [];
      const safeGraph = {
        nodes: data?.graph?.nodes ?? [],
        links: data?.graph?.links ?? []
      };
      
      setResults(safeTable);
      setGraphContext(safeGraph);
      
      if (onSearchExecuted) {
        onSearchExecuted(safeGraph, safeTable, `Semantic Search: "${q}"`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during search.");
    } finally {
      setLoading(false);
    }
  };

  // Extract patients diagnosed with the disease from returned graph
  const getDiagnosedPatients = (diseaseName) => {
    if (!graphContext || !graphContext.nodes) return [];
    
    // Find disease node id
    const diseaseNode = graphContext.nodes.find(
      n => n && n.group === 'Disease' && n.label === diseaseName
    );
    if (!diseaseNode) return [];

    // Find patients connected to this disease node
    const connectedPatientIds = (graphContext.links ?? [])
      .filter(l => {
        if (!l) return false;
        const sourceId = typeof l.source === 'object' ? l.source?.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target?.id : l.target;
        return sourceId === diseaseNode.id || targetId === diseaseNode.id;
      })
      .map(l => {
        const sourceId = typeof l.source === 'object' ? l.source?.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target?.id : l.target;
        return sourceId === diseaseNode.id ? targetId : sourceId;
      });

    return graphContext.nodes.filter(
      n => n && n.group === 'Patient' && connectedPatientIds.includes(n.id)
    );
  };

  return (
    <div className="medical-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: '#FFFFFF' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <Sparkles size={20} color="var(--primary-navy)" />
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--primary-navy)' }}>Semantic Patient Search</h4>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Query disease symptoms or classifications in plain English. The grounded system translates phrases to clinical indices using Neo4j cosine similarity.
      </p>

      {/* Input */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="var(--text-light)" style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }} />
          <input
            type="text"
            className="medical-input"
            placeholder="Search symptoms, diseases, or medical profiles (e.g. chest pain)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '44px'
            }}
          />
        </div>
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Common symptom sets:</span>
        {SUGGESTIONS.map((sug, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSearchQuery(sug);
              handleSearch(sug);
            }}
            style={{
              background: '#F1F5F9',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '4px 12px',
              color: 'var(--primary-navy)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.borderColor = 'var(--primary-navy)';
              e.target.style.background = '#E2E8F0';
            }}
            onMouseOut={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.background = '#F1F5F9';
            }}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Search Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
        
        {loading && (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--alert-red-light)',
            border: '1px solid var(--alert-red)',
            color: 'var(--alert-red)',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}
        
        {results.length === 0 && !loading && !error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            color: 'var(--text-muted)',
            fontSize: '13px',
            border: '1.5px dashed var(--border-color)',
            borderRadius: '12px',
            padding: '40px',
            gap: '8px'
          }}>
            <Heart size={24} color="var(--text-light)" />
            <span>Type symptoms or choose a symptom set to find matching clinical records.</span>
          </div>
        )}

        {results.map((res, idx) => {
          const matchingPatients = getDiagnosedPatients(res.disease_name);

          return (
            <div key={idx} className="medical-card" style={{
              background: '#FFFFFF',
              border: '1.5px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '18px 20px'
            }}>
              {/* Card Title & Similarity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span className="med-badge med-badge-red" style={{ marginRight: '8px' }}>
                    ICD-10: {res.icd_code}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary-navy)' }}>
                    {res.disease_name}
                  </span>
                </div>
                
                <span className="med-badge med-badge-green">
                  {Math.round((res.similarity_score ?? res.similarity ?? 0) * 100)}% Similarity
                </span>
              </div>

              {/* Description */}
              <p style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                margin: 0
              }}>
                {res.description}
              </p>

              {/* Connected diagnosed patients */}
              {matchingPatients.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '12px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                    Diagnosed Patients ({matchingPatients.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matchingPatients.map(pat => (
                      <div key={pat.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#F8FAFC',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '13px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary-navy)' }}>{pat.label}</span>
                          <span style={{ color: 'var(--text-muted)' }}>({pat.properties?.age || 'Age N/A'} y.o.)</span>
                        </div>
                        <span className="med-badge med-badge-blue" style={{ fontSize: '9px' }}>
                          ID: {pat.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn-med-outline"
                  onClick={() => handleSearch(res.disease_name)}
                  style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px' }}
                >
                  <Pin size={12} />
                  Center Graph
                </button>
                
                <button
                  className="btn-med-primary"
                  onClick={() => onSendToChat(res)}
                  style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px' }}
                >
                  <Send size={12} />
                  Analyze Patient Risk
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

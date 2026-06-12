import React, { useState } from 'react';
import { Search, Sparkles, Pin, Send, HelpCircle } from 'lucide-react';

const SUGGESTIONS = [
  "frequent urination and excessive thirst",
  "chest pain and breathing difficulties",
  "joint pain and knee stiffness",
  "severe throbbing headache and nausea"
];

export default function SemanticSearch({ onSearchExecuted, onSendToChat, backendUrl }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (queryText) => {
    const q = queryText || searchQuery;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setSearchQuery(q);

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
        throw new Error(errDetail.detail || "Vector search query failed.");
      }

      const data = await response.json();
      setResults(data.table || []);
      
      if (onSearchExecuted) {
        // Send graph structure to the parent to draw/highlight
        onSearchExecuted(data.graph, data.table, `Semantic Search: "${q}"`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <Sparkles size={18} color="var(--accent-blue)" />
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFF' }}>Semantic Vector Search</h4>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        Query disease and drug descriptions in plain English. The vector index performs cosine similarity search.
      </p>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} color="var(--text-secondary)" style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }} />
          <input
            type="text"
            className="input-text"
            placeholder="Type symptoms (e.g. cough and fever)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              width: '100%',
              paddingLeft: '36px'
            }}
          />
        </div>
        <button 
          className="btn-primary" 
          onClick={() => handleSearch()}
          disabled={loading}
          style={{ padding: '0 16px', fontSize: '12px' }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Try:</span>
        {SUGGESTIONS.map((sug, idx) => (
          <button
            key={idx}
            onClick={() => handleSearch(sug)}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '2px 8px',
              color: 'var(--text-secondary)',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.borderColor = 'rgba(0, 212, 255, 0.3)'}
            onMouseOut={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)'}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Search Results List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '180px' }}>
        {error && (
          <div style={{ fontSize: '11px', color: 'var(--alert-red)' }}>
            Error: {error}
          </div>
        )}
        
        {results.length === 0 && !loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'var(--text-muted)',
            fontSize: '12px',
            border: '1px dashed rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            minHeight: '100px'
          }}>
            No matches found yet. Type symptoms to start.
          </div>
        )}

        {results.map((res, idx) => (
          <div key={idx} style={{
            background: 'rgba(5, 8, 17, 0.5)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px',
            transition: 'border-color 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-grounded" style={{ fontSize: '9px', marginRight: '6px' }}>
                  ICD-10: {res.icd_code}
                </span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#FFF' }}>
                  {res.disease_name}
                </span>
              </div>
              <span className="badge badge-grounded" style={{
                background: 'rgba(46, 213, 115, 0.15)',
                color: '#2ED573',
                border: '1px solid rgba(46, 213, 115, 0.3)'
              }}>
                {Math.round(res.similarity_score * 100)}% Match
              </span>
            </div>

            <p style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {res.description}
            </p>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', justifyContent: 'flex-end' }}>
              <button
                className="btn-outline"
                onClick={() => handleSearch(res.disease_name)} // Re-triggers full fetch focusing node
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
              >
                <Pin size={10} />
                Highlight Graph
              </button>
              
              <button
                className="btn-primary"
                onClick={() => onSendToChat(res)}
                style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px' }}
              >
                <Send size={10} />
                Analyze with Claude
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

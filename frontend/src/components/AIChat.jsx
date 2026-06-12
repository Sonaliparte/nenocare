import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles, ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';

const SUGGESTIONS = [
  "Is Bob Brown at risk of any drug-disease conflicts?",
  "What is the symptom pathway for COVID-19?",
  "Which patients are diagnosed with Hypertension and what are they taking?",
  "Analyze doctor workload. Are patient loads evenly distributed?"
];

export default function AIChat({ graphContext, onQuerySuggestion, backendUrl }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your clinical GraphRAG assistant. I'm connected to your Neo4j database and backed by Claude 3.5 Sonnet.\n\nRun queries on the left, and ask me questions here. I will ground my answers strictly in your active graph data to prevent hallucinations.",
      grounded: false
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const activeNodesCount = graphContext?.nodes?.length || 0;
  const activeLinksCount = graphContext?.links?.length || 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          graph_context: graphContext || { nodes: [], links: [] }
        })
      });

      if (!response.ok) {
        throw new Error("AI analysis endpoint returned an error.");
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        grounded: data.grounded
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Error: Failed to connect to the GraphRAG service. Please ensure your backend is running and ANTHROPIC_API_KEY is configured.",
        grounded: false,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
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
          <MessageSquare size={18} color="var(--accent-blue)" />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#FFF' }}>Claude 3.5 Sonnet RAG</h4>
        </div>
        
        {/* Context Status Badge */}
        {activeNodesCount > 0 ? (
          <span className="badge badge-grounded" style={{ fontSize: '10px' }}>
            {activeNodesCount} nodes, {activeLinksCount} paths in context
          </span>
        ) : (
          <span className="badge" style={{
            fontSize: '10px',
            background: 'rgba(255, 165, 2, 0.1)',
            color: '#FFA502',
            border: '1px solid rgba(255, 165, 2, 0.2)'
          }}>
            No context (will fallback)
          </span>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#060912'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            {/* Message Bubble */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              borderTopRightRadius: msg.role === 'user' ? '0' : '12px',
              borderTopLeftRadius: msg.role === 'user' ? '12px' : '0',
              background: msg.role === 'user' 
                ? 'linear-gradient(135deg, rgba(0, 163, 255, 0.15) 0%, rgba(0, 212, 255, 0.15) 100%)'
                : 'rgba(16, 24, 48, 0.6)',
              border: msg.role === 'user'
                ? '1px solid rgba(0, 212, 255, 0.3)'
                : '1px solid var(--border-color)',
              color: msg.isError ? 'var(--alert-red)' : 'var(--text-primary)',
              fontSize: '13px',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {msg.content}
            </div>

            {/* Grounded Badge for AI replies */}
            {msg.role === 'assistant' && msg.grounded && (
              <div 
                className="badge badge-grounded" 
                style={{
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '9px',
                  padding: '2px 8px',
                  boxShadow: '0 0 8px rgba(0, 212, 255, 0.2)',
                  animation: 'pulse 2s infinite'
                }}
              >
                <ShieldCheck size={11} color="var(--accent-blue)" />
                Hallucination Prevention Active
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <span className="animate-pulse" style={{ color: 'var(--accent-blue)' }}>Claude is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {activeNodesCount > 0 && messages.length === 1 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.03)', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#05070d' }}>
          {SUGGESTIONS.map((sug, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sug)}
              style={{
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.1)',
                borderRadius: '6px',
                padding: '4px 8px',
                color: 'var(--accent-blue)',
                fontSize: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(0, 212, 255, 0.15)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(0, 212, 255, 0.05)'}
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Warn if no context */}
      {activeNodesCount === 0 && (
        <div style={{
          padding: '6px 16px',
          background: 'rgba(255, 165, 2, 0.05)',
          borderTop: '1px solid rgba(255, 165, 2, 0.1)',
          color: '#FFA502',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <AlertCircle size={12} />
          Context is empty. Trigger queries or searches to seed Claude context.
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        background: '#05070c',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          className="input-text"
          placeholder="Ask Claude clinical questions (e.g. is John Doe at risk?)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button
          className="btn-primary"
          onClick={() => handleSend()}
          style={{ padding: '0 16px' }}
          disabled={loading}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

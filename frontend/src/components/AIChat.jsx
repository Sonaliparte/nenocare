import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, ShieldCheck, AlertCircle, Cpu, HelpCircle } from 'lucide-react';

const SUGGESTIONS = [
  "Who is at risk?",
  "Show drug conflicts",
  "Which doctor treats most patients?"
];

export default function AIChat({ graphContext, onQuerySuggestion, backendUrl }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your clinical GraphRAG assistant. I'm connected to your Neo4j database and backed by Claude 3.5 Sonnet.\n\nAsk me clinical questions regarding patients, diseases, and prescriptions. I will ground my answers strictly in your active database graph to prevent hallucinations.",
      grounded: false
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiMissingError, setApiMissingError] = useState(false);
  const messagesEndRef = useRef(null);

  const activeNodesCount = graphContext?.nodes?.length ?? 0;
  const activeLinksCount = graphContext?.links?.length ?? 0;

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
    setApiMissingError(false);

    try {
      const response = await fetch(`${backendUrl}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          graph_context: {
            nodes: graphContext?.nodes ?? [],
            links: graphContext?.links ?? []
          }
        })
      });

      if (!response.ok) {
        const errDetail = await response.json();
        const detailMsg = errDetail?.detail || "";
        if (detailMsg.includes("ANTHROPIC_API_KEY") || detailMsg.includes("configured") || detailMsg.includes("key")) {
          setApiMissingError(true);
          throw new Error("AI features require Anthropic API credits. Graph search still works!");
        }
        throw new Error(detailMsg || "AI analysis endpoint returned an error.");
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data?.answer || "No clinical analysis was generated.",
        grounded: !!data?.grounded
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.message || "Failed to contact clinical AI service. Please verify your backend container is running.",
        grounded: false,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="medical-card" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '520px',
      padding: '0',
      overflow: 'hidden',
      background: '#FFFFFF'
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        zIndex: 10,
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="var(--primary-navy)" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--primary-navy)' }}>Grounded Clinical AI Assistant</h4>
        </div>
        
        {/* Status Badges */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="med-badge med-badge-blue" style={{ fontSize: '10px' }}>
            <Cpu size={10} style={{ marginRight: '2px' }} />
            Powered by Claude AI
          </span>
          <span className="med-badge med-badge-green" style={{ fontSize: '10px' }}>
            <ShieldCheck size={10} style={{ marginRight: '2px' }} />
            Hallucination Prevention: ON
          </span>
        </div>
      </div>

      {/* Warning Area */}
      {apiMissingError && (
        <div style={{
          background: 'var(--alert-red-light)',
          borderBottom: '1px solid var(--alert-red)',
          color: 'var(--alert-red)',
          padding: '10px 20px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} />
          <span>AI features require Anthropic API credits. Graph search still works!</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#F8FAFC'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            {/* Bubble */}
            <div className={msg.role === 'user' ? 'chat-bubble-patient' : 'chat-bubble-assistant'} style={{
              borderTopRightRadius: msg.role === 'user' ? '0' : '12px',
              borderTopLeftRadius: msg.role === 'user' ? '12px' : '0',
              border: msg.isError ? '1.5px solid var(--alert-red)' : undefined,
              color: msg.isError ? 'var(--alert-red)' : undefined,
              whiteSpace: 'pre-line'
            }}>
              {msg.content}
            </div>

            {/* Grounded badge */}
            {msg.role === 'assistant' && msg.grounded && (
              <div 
                className="med-badge med-badge-green" 
                style={{
                  marginTop: '4px',
                  fontSize: '9px',
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ShieldCheck size={10} color="var(--accent-green)" />
                Grounded GraphRAG Response
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
            <span>Claude is synthesizing clinical context...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div style={{ 
        padding: '10px 16px', 
        borderTop: '1px solid var(--border-color)', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '8px', 
        background: '#FFFFFF',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Suggestions:</span>
        {SUGGESTIONS.map((sug, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(sug)}
            disabled={loading}
            style={{
              background: '#F1F5F9',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '4px 12px',
              color: 'var(--primary-navy)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.background = '#E2E8F0';
                e.target.style.borderColor = 'var(--primary-navy)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.target.style.background = '#F1F5F9';
                e.target.style.borderColor = 'var(--border-color)';
              }
            }}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        background: '#FFFFFF',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          className="medical-input"
          placeholder="Ask clinical queries grounded in patient graphs (e.g. who is at risk?)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button
          className="btn-med-primary"
          onClick={() => handleSend()}
          disabled={loading}
          style={{ height: '40px', padding: '0 16px', borderRadius: '8px' }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Users, FileText, AlertTriangle, Activity } from 'lucide-react';

function CountingNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const end = parseInt(value, 10);
    if (isNaN(end) || end <= 0) {
      setDisplayValue(value);
      return;
    }
    
    let start = 0;
    const duration = 600; // Total animation duration in ms
    const totalSteps = 20;
    const stepTime = duration / totalSteps;
    const increment = Math.max(1, Math.ceil(end / totalSteps));
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(start);
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [value]);

  return <span className="animate-number">{displayValue}</span>;
}

export default function StatsCards({ stats, onConflictCardClick }) {
  const {
    totalPatients = 0,
    totalPrescriptions = 0,
    activeConflicts = 0,
    mostCommonDisease = 'None'
  } = stats || {};

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    }}>
      {/* Total Patients */}
      <div className="medical-card" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(2, 132, 199, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Users size={24} color="var(--accent-blue)" />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Patients</p>
          <h3 style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: 'var(--primary-navy)' }}>
            <CountingNumber value={totalPatients} />
          </h3>
        </div>
      </div>

      {/* Total Prescriptions */}
      <div className="medical-card" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(0, 168, 120, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <FileText size={24} color="var(--accent-green)" />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Prescriptions</p>
          <h3 style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', color: 'var(--primary-navy)' }}>
            <CountingNumber value={totalPrescriptions} />
          </h3>
        </div>
      </div>

      {/* Drug Conflict Alerts */}
      <div 
        className="medical-card"
        onClick={activeConflicts > 0 ? onConflictCardClick : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '20px',
          cursor: activeConflicts > 0 ? 'pointer' : 'default',
          border: activeConflicts > 0 ? '1.5px solid var(--alert-red)' : '1px solid var(--border-color)',
          background: activeConflicts > 0 ? 'rgba(230, 57, 70, 0.02)' : 'var(--bg-card)'
        }}
      >
        <div style={{
          background: activeConflicts > 0 ? 'rgba(230, 57, 70, 0.1)' : 'rgba(148, 163, 184, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <AlertTriangle size={24} color={activeConflicts > 0 ? 'var(--alert-red)' : 'var(--text-light)'} />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Conflict Alerts</p>
          <h3 style={{ 
            fontSize: '26px', 
            fontWeight: 800, 
            marginTop: '4px', 
            color: activeConflicts > 0 ? 'var(--alert-red)' : 'var(--primary-navy)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CountingNumber value={activeConflicts} />
            {activeConflicts > 0 && (
              <span className="med-badge med-badge-red" style={{ fontSize: '9px', padding: '2px 8px' }}>Urgent</span>
            )}
          </h3>
        </div>
      </div>

      {/* Most Common Disease */}
      <div className="medical-card" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(234, 88, 12, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Activity size={24} color="var(--accent-orange)" />
        </div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Top Disease</p>
          <h3 style={{ 
            fontSize: '15px', 
            fontWeight: 700, 
            marginTop: '6px', 
            color: 'var(--primary-navy)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={mostCommonDisease}>
            {mostCommonDisease}
          </h3>
        </div>
      </div>
    </div>
  );
}

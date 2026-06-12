import React from 'react';
import { Users, FileText, AlertTriangle, Activity } from 'lucide-react';

export default function StatsCards({ stats, onConflictCardClick }) {
  const {
    totalPatients = 0,
    totalPrescriptions = 0,
    activeConflicts = 0,
    mostCommonDisease = 'None'
  } = stats;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
      marginBottom: '20px'
    }}>
      {/* Total Patients */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 20px'
      }}>
        <div style={{
          background: 'rgba(0, 212, 255, 0.1)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Users size={24} color="#00D4FF" />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Patients</p>
          <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#FFF' }}>{totalPatients}</h3>
        </div>
      </div>

      {/* Total Prescriptions */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 20px'
      }}>
        <div style={{
          background: 'rgba(0, 212, 255, 0.1)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <FileText size={24} color="#00D4FF" />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescriptions</p>
          <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: '#FFF' }}>{totalPrescriptions}</h3>
        </div>
      </div>

      {/* Drug Conflict Alerts */}
      <div 
        className={`glass-panel ${activeConflicts > 0 ? 'pulse-glow' : ''}`}
        onClick={activeConflicts > 0 ? onConflictCardClick : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          cursor: activeConflicts > 0 ? 'pointer' : 'default',
          border: activeConflicts > 0 ? '1px solid rgba(255, 71, 87, 0.4)' : '1px solid var(--border-color)',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{
          background: activeConflicts > 0 ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: activeConflicts > 0 ? '1px solid rgba(255, 71, 87, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <AlertTriangle size={24} color={activeConflicts > 0 ? '#FF4757' : 'var(--text-secondary)'} />
        </div>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conflict Alerts</p>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: 800, 
            marginTop: '4px', 
            color: activeConflicts > 0 ? '#FF4757' : '#FFF',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {activeConflicts}
            {activeConflicts > 0 && (
              <span className="badge badge-danger" style={{ fontSize: '9px', padding: '2px 6px' }}>Urgent</span>
            )}
          </h3>
        </div>
      </div>

      {/* Most Common Disease */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 20px'
      }}>
        <div style={{
          background: 'rgba(0, 212, 255, 0.1)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Activity size={24} color="#00D4FF" />
        </div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Disease</p>
          <h3 style={{ 
            fontSize: '15px', 
            fontWeight: 700, 
            marginTop: '6px', 
            color: '#FFF',
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

import React from 'react';
import Slidebar from '../components/Slidebar';
import HeaderSection from '../components/HeaderSection';

const Card: React.FC<{ children?: React.ReactNode, style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)', ...style }}>{children}</div>
);

const Dashboard: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection />

        <main style={{ padding: '24px 36px' }}>
          <div style={{ display: 'flex', gap: 18, marginLeft: 20  }}>
            <div style={{ flex: 1 }}>
              <Card>
                <h3 style={{ margin: 0, marginBottom: 12 }}>Current visits</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 360, height: 280, borderRadius: 12, background: 'linear-gradient(180deg,#fff,#f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: 700 }}>Pie Chart</div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 220, borderRadius: 12, background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Legend / small list</div>
                </div>
                </div>
              </Card>
            </div>

            <div style={{ flex: 2 }}>
              <Card>
                <h3 style={{ margin: 0, marginBottom: 12 }}>Website visits</h3>
                <div style={{ height: 360, borderRadius: 12, background: 'linear-gradient(180deg,#fff,#fbfbfd)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: 700 }}>Bar Chart</div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

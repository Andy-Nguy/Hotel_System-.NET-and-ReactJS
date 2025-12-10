import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type RevenuePoint = { date: string; revenue: number; roomRevenue?: number; serviceRevenue?: number };
type OccupancyPoint = { date: string; occupancyRate: number };
type CustomerOriginPoint = { origin: string; count: number };

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#8dd1e1'];

export const LineChartComponent: React.FC<{ data: RevenuePoint[]; dataKey?: string }> = ({ data, dataKey = 'revenue' }) => {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BarChartComponent: React.FC<{ data: OccupancyPoint[]; dataKey?: string }> = ({ data, dataKey = 'occupancyRate' }) => {
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={dataKey} fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AreaChartComponent: React.FC<{ data: any[]; dataKey?: string; xKey?: string }> = ({ data, dataKey = 'occupancyRate', xKey = 'date' }) => {
  const formatNumber = (v: any) => {
    if (v == null) return '';
    if (typeof v === 'number') return v.toLocaleString();
    const n = Number(v);
    return isNaN(n) ? v : n.toLocaleString();
  };

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="areaBlueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="areaGreenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: any) => formatNumber(v)} />
          {/* Draw blue base area then green overlay for depth */}
          <Area type="monotone" dataKey={dataKey} stroke="#1e3a8a" strokeWidth={1} fillOpacity={0.75} fill="url(#areaBlueGradient)" />
          <Area type="monotone" dataKey={dataKey} stroke="#047857" strokeWidth={2} fillOpacity={0.6} fill="url(#areaGreenGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PieChartComponent: React.FC<{ data: CustomerOriginPoint[]; nameKey?: string; valueKey?: string; colors?: string[]; height?: number }> = ({ data, nameKey = 'origin', valueKey = 'count', colors, height }) => {
  const palette = (colors && colors.length) ? colors : COLORS;
  const total = data.reduce((s, d) => s + (d as any)[valueKey], 0);
  const h = typeof height === 'number' ? height : 260;
  const outerR = Math.max(60, Math.floor(h * 0.28));
  return (
    <div style={{ width: '100%', height: h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data as any} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="45%" outerRadius={outerR} label={(entry: any) => `${Math.round(((entry[valueKey]||0)/ (total||1))*100)}%`}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default {};

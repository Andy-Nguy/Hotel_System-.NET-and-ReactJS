import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

export const PieChartComponent: React.FC<{ data: CustomerOriginPoint[]; nameKey?: string; valueKey?: string }> = ({ data, nameKey = 'origin', valueKey = 'count' }) => {
  const total = data.reduce((s, d) => s + (d as any)[valueKey], 0);
  return (
    <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data as any} dataKey={valueKey} nameKey={nameKey} cx="50%" cy="45%" outerRadius={80} label={(entry: any) => `${Math.round(((entry[valueKey]||0)/ (total||1))*100)}%`}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

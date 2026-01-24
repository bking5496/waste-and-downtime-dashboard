import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { WasteEntry, DowntimeEntry } from '../types';

interface DashboardChartsProps {
  wasteEntries: WasteEntry[];
  downtimeEntries: DowntimeEntry[];
}

const COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];

// Empty state component
const EmptyChart: React.FC<{ message: string; icon: string }> = ({ message, icon }) => (
  <div className="chart-empty-state">
    <span className="empty-icon">{icon}</span>
    <span className="empty-text">{message}</span>
  </div>
);

const DashboardCharts: React.FC<DashboardChartsProps> = ({ wasteEntries, downtimeEntries }) => {
  // Aggregate waste by type
  const wasteData = wasteEntries.reduce((acc: any[], entry) => {
    const existing = acc.find(item => item.name === entry.wasteType);
    if (existing) {
      existing.value += entry.waste;
    } else {
      acc.push({ name: entry.wasteType, value: entry.waste });
    }
    return acc;
  }, []);

  // Aggregate downtime by reason
  const downtimeData = downtimeEntries.reduce((acc: any[], entry) => {
    const existing = acc.find(item => item.name === entry.downtimeReason);
    if (existing) {
      existing.value += entry.downtime;
    } else {
      acc.push({ name: entry.downtimeReason, value: entry.downtime });
    }
    return acc;
  }, []);

  return (
    <div className="charts-grid">
      <div className="chart-container">
        <h4 className="chart-title">Waste by Type</h4>
        {wasteData.length === 0 ? (
          <EmptyChart message="No waste entries yet" icon="📊" />
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={wasteData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,245,255,0.1)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#00f5ff', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(0,245,255,0.2)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#00f5ff', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(0,245,255,0.2)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,25,40,0.95)',
                    border: '1px solid rgba(0,245,255,0.2)',
                    borderRadius: '8px',
                    color: '#f8fafc'
                  }}
                />
                <Bar dataKey="value" fill="#f87171" name="Waste (kg)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="chart-container">
        <h4 className="chart-title">Downtime by Reason</h4>
        {downtimeData.length === 0 ? (
          <EmptyChart message="No downtime entries yet" icon="⏱️" />
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={downtimeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name: string; percent: number }) => 
                    percent > 0.1 ? `${(percent * 100).toFixed(0)}%` : ''
                  }
                  outerRadius={65}
                  innerRadius={35}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="rgba(15,23,42,0.5)"
                  strokeWidth={2}
                >
                  {downtimeData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,25,40,0.95)',
                    border: '1px solid rgba(0,245,255,0.2)',
                    borderRadius: '8px',
                    color: '#f8fafc'
                  }}
                  formatter={(value: number) => [`${value} min`, 'Duration']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {downtimeData.map((entry: any, index: number) => (
                <div key={entry.name} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="legend-label">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardCharts;

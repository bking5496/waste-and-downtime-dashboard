import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { WasteEntry, DowntimeEntry } from '../types';

interface DashboardChartsProps {
  wasteEntries: WasteEntry[];
  downtimeEntries: DowntimeEntry[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
    <div className="row mt-4">
      <div className="col-md-6">
        <h4>Waste by Type</h4>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={wasteData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" name="Waste (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="col-md-6">
        <h4>Downtime by Reason</h4>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={downtimeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {downtimeData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardCharts;

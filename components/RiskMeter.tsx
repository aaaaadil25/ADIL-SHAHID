
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface RiskMeterProps {
  score: number;
}

const RiskMeter: React.FC<RiskMeterProps> = ({ score }) => {
  const data = [
    { name: 'Risk', value: score },
    { name: 'Safety', value: 100 - score },
  ];

  const getColor = (s: number) => {
    if (s < 30) return '#10b981'; 
    if (s < 70) return '#f59e0b'; 
    return '#ef4444';
  };

  const color = getColor(score);

  return (
    <div className="relative h-44 w-full flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={65}
            outerRadius={85}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="risk" fill={color} />
            <Cell key="safety" fill="rgba(255,255,255,0.03)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 text-center">
        <span className="text-5xl font-bold tracking-tight text-white" style={{ color: score > 70 ? '#ef4444' : 'white' }}>{score}</span>
        <div className="h-[2px] w-6 bg-[#E2B859]/40 mx-auto my-2 rounded-full"></div>
        <p className="text-[10px] text-slate-500 font-bold tracking-wider">Risk Level</p>
      </div>
    </div>
  );
};

export default RiskMeter;

import React from "react";

type ChartPoint = {
  label: string;
  value: number;
};

type ChartsProps = {
  data: ChartPoint[];
};

const Charts: React.FC<ChartsProps> = ({ data }) => {
  return (
    <section>
      <h3>Analytics</h3>
      {data.length === 0 ? (
        <p>No chart data available.</p>
      ) : (
        <ul>
          {data.map((point) => (
            <li key={point.label}>
              {point.label}: {point.value}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default Charts;

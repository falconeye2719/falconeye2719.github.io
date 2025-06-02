import React from 'react';

function ResultDisplay({ results, maxHeight = '300px' }) {
  return (
    <div style={{ ...resultDisplayStyle, maxHeight: maxHeight, overflowY: 'auto' }}>
      <h2>シミュレーション結果</h2>
      <table>
        <thead>
          <tr>
            <th>ポイント名</th>
            <th>累積距離 (km)</th>
            <th>標高 (m)</th>
            <th>予測到着時間</th>
          </tr>
        </thead>
        <tbody>
          {results && results.map((result, index) => (
            <tr key={index}>
              <td>{result.name}</td>
              <td>{result.cumulativeDistance ? result.cumulativeDistance.toFixed(2) : '-'}</td>
              <td>{result.elevation !== null ? result.elevation.toFixed(0) : '-'}</td>
              <td>{result.arrivalTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const resultDisplayStyle = {
  border: '1px solid #ddd',
  padding: '20px',
  margin: '20px',
  borderRadius: '5px',
  width: '100%',
  maxWidth: '800px', // 幅を少し広げる
  overflowX: 'auto',
};

export default ResultDisplay;
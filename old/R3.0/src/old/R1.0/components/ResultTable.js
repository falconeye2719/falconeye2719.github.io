import React from 'react';

const containerStyle = {
  marginTop: '20px',
  maxHeight: '300px', // 適切な高さを設定してください
  overflowY: 'auto',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thTdStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
};

const stickyHeaderStyle = {
  ...thTdStyle,
  position: 'sticky',
  top: 0,
  backgroundColor: '#f2f2f2', // ヘッダーの背景色（必要に応じて調整）
  zIndex: 1, // 他の要素より前面に表示
};

function ResultTable({ data }) {
  if (!data || data.length === 0) {
    return <p>シミュレーション結果はありません。</p>;
  }

  return (
    <div style={containerStyle}>
      <h2>トラックポイント情報</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={stickyHeaderStyle}>区分</th>
            <th style={stickyHeaderStyle}>区分名称</th>
            <th style={stickyHeaderStyle}>累積距離 (km)</th>
            <th style={stickyHeaderStyle}>区間距離 (km)</th>
            <th style={stickyHeaderStyle}>標高 (m)</th>
            <th style={stickyHeaderStyle}>到着時刻 (HH:MM)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              <td style={thTdStyle}>{item.区分}</td>
              <td style={thTdStyle}>{item.区分名称}</td>
              <td style={thTdStyle}>{item.累積距離}</td>
              <td style={thTdStyle}>{item.区間距離}</td>
              <td style={thTdStyle}>{item.標高 !== null ? item.標高 : '-'}</td>
              <td style={thTdStyle}>{item.到着時刻 ? item.到着時刻.slice(0, 5) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResultTable;
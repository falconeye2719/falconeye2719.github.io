import React from 'react';

const paceInputStyle = { // ← ここで paceInputStyle を定義
  border: '1px solid #ddd',
  padding: '20px',
  margin: '20px',
  borderRadius: '5px',
};

function PaceInput({ startTime, averagePace, onStartTimeChange, onAveragePaceChange, onSimulate }) {
  return (
    <div style={paceInputStyle}>
      <h2>ペース入力</h2>
      <div>
        <label htmlFor="startTime">START時間 (HH:MM):</label>
      <input
        type="text"
        id="startTime"
        value={startTime}
        onChange={(e) => onStartTimeChange(e)} // ← ここが重要
        placeholder="例: 09:00"
      />
      </div>
      <div>
        <label htmlFor="averagePace">平均ペース (分:秒/km):</label>
      <input
        type="text"
        id="averagePace"
        value={averagePace}
        onChange={(e) => onAveragePaceChange(e)} // ← ここを確認
        placeholder="例: 6:30"
      />
      </div>
      <button onClick={onSimulate}>シミュレーション実行</button>
    </div>
  );
}

export default PaceInput;
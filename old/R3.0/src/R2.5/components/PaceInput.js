import React from 'react';

const paceInputStyle = {
  border: '1px solid #ddd',
  padding: '20px',
  margin: '20px',
  borderRadius: '5px',
};

function PaceInput({
  startTime,
  averagePace,
  onStartTimeChange,
  onAveragePaceChange,
  onSimulate,
  itraIndex, // ★ 追加
  onItraIndexChange, // ★ 追加
}) {
  return (
    <div style={paceInputStyle}>
      <h2>シミュレーション情報入力</h2>
      <div>
        <label htmlFor="startTime">START時間 (HH:MM):</label>
        <input
          type="text"
          id="startTime"
          value={startTime}
          onChange={onStartTimeChange}
          placeholder="例: 09:00"
        />
      </div>
      <div>
        <label htmlFor="averagePace">平地10km平均ペース (分:秒/km):</label>
        <input
          type="text"
          id="averagePace"
          value={averagePace}
          onChange={onAveragePaceChange}
          placeholder="例: 6:30"
        />
      </div>
      {/* ★ ITRA パフォーマンスインデックスの入力欄を追加 ★ */}
      <div>
        <label htmlFor="itraIndex">ITRA パフォーマンスインデックス:</label>
        <input
          type="number"
          id="itraIndex"
          value={itraIndex}
          onChange={onItraIndexChange}
          min="0"
          max="1000"
        />
      </div>
      <button onClick={onSimulate}>シミュレーション実行</button>
    </div>
  );
}

export default PaceInput;
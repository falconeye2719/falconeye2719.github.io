import React, { useState, useCallback } from 'react';

const paceInputStyle = {
    border: '1px solid #ddd',
    padding: '20px',
    margin: '20px',
    borderRadius: '5px',
};

function PaceInput({
    startTime,
    onStartTimeChange,
    onSimulate,
    itraIndex,
    onItraIndexChange,
    onFlatPaceInputChange, // ★ 追加
    flatPaceInput,       // ★ 追加
    calculatePaceFromFinishTime, // ★ 追加
    calculatedAveragePace // ★ 追加
}) {
  return (
    <div style={paceInputStyle}>
      <h2>シミュレーション情報入力</h2>
      <div>
        <label htmlFor="startTime">START時間 (HH:MM):</label>
        <input
          type="time"
          id="startTime"
          value={startTime}
          onChange={onStartTimeChange}
          placeholder="例: 09:00"
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
      <div>
        <label htmlFor="flatPaceInput">フルマラソン完走予想 (HH:MM):</label>
        <input
          type="time"
          id="flatPaceInput"
          value={flatPaceInput}
          onChange={onFlatPaceInputChange}
          placeholder="例: 03:30"
        />
        <button type="button" onClick={calculatePaceFromFinishTime}>参考ペースを計算</button>
        {calculatedAveragePace && <p>平地参考ペース: {calculatedAveragePace} / km</p>} {/* ★ 平均ペース表示エリア ★ */}
      </div>
      <button onClick={onSimulate}>シミュレーション実行</button>
    </div>
  );
}

export default PaceInput;
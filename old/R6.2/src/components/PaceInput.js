import React, { useState, useEffect } from 'react';
import './PaceInput.css'; // CSSファイルをインポート

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
    onFlatPaceInputChange,
    flatPaceInput,
    calculatePaceFromFinishTime,
    calculatedAveragePace
}) {
    const [isButtonFlashing, setIsButtonFlashing] = useState(false);

    useEffect(() => {
        // 完走予想タイムが入力されたらフリッカーを開始
        const timeFormatRegex = /^\d{2}:\d{2}$/; // 簡単なHH:MM形式チェック
        if (timeFormatRegex.test(flatPaceInput) && !calculatedAveragePace) {
            setIsButtonFlashing(true);
        } else {
            setIsButtonFlashing(false);
        }
    }, [flatPaceInput, calculatedAveragePace]);

    const handlePaceButtonClick = () => {
        calculatePaceFromFinishTime();
        setIsButtonFlashing(false); // ボタンクリックでフリッカー停止
    };

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
                <button
                    type="button"
                    onClick={handlePaceButtonClick}
                    className={isButtonFlashing ? 'flashing-button' : ''}
                    disabled={!flatPaceInput}
                >
                    ペースを計算
                </button>
                {calculatedAveragePace && <p>平地参考ペース: {calculatedAveragePace} / km</p>} {/* ★ 平均ペース表示エリア ★ */}
            </div>
            <button onClick={onSimulate} disabled={!calculatedAveragePace}>シミュレーション実行</button>
            {!calculatedAveragePace && flatPaceInput && (
                <p style={{ color: 'red' }}>ペースを計算してからシミュレーションを実行してください。</p>
            )}
        </div>
    );
}

export default PaceInput;
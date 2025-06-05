import React, { useState, useEffect } from 'react';
import './PaceInput.css'; // CSSファイルをインポート
import Tooltip from './Tooltip'; 

const paceInputStyle = {
    border: '1px solid #ddd',
    padding: '20px',
    margin: '20px',
    borderRadius: '5px',
};

function PaceInput({
    startTime,
    finishTime, // ★ 追加: FINISH時間を受け取るプロップ ★
    onStartTimeChange,
    onFinishTimeChange, // ★ 追加: FINISH時間変更ハンドラを受け取るプロップ ★
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
            <div className="input-group time-inputs-container">
                <div>
                    <label htmlFor="startTime">
                        レース開始時間～制限時間 (HH:MM)：
                        <Tooltip text={"レースの開始時間と制限時間を HH:MM 形式で入力してください\n例:17:00～11:00"} />
                    </label>
                    <input
                        type="time"
                        id="startTime"
                        value={startTime}
                        onChange={onStartTimeChange}
                        placeholder="例: 09:00"
                    />
                </div>
                <div>
                    <label htmlFor="finishTime">～</label>
                    <input
                        type="time"
                        id="finishTime"
                        value={finishTime}
                        onChange={onFinishTimeChange}
                        placeholder="例: 09:00"
                    />
                </div>
            </div>
            {/* ★ ITRA パフォーマンスインデックスの入力欄を追加 ★ */}
            <div className="input-group">
                <label htmlFor="itraIndex">
                    ITRA パフォーマンスインデックス(1～1000)：
                    <Tooltip text={"あなたのITRAパフォーマンスインデックスに基づき、持久力を自動調整します（デフォルト400）\n不明な場合は以下を参考に\n【1～300】初心者\n【301～550】中級者（ボリュームゾーン）\n【551～725】上級者\n【726～825】国内大会入賞レベル\n【825～1000】国際大会入賞レベル"} />
                </label>
                <input
                    type="number"
                    id="itraIndex"
                    value={itraIndex}
                    onChange={onItraIndexChange}
                    min="0"
                    max="1000"
                />
            </div>
            <div className="input-group">
                <label htmlFor="flatPaceInput">
                    フルマラソン完走予想時間 (HH:MM)：
                    <Tooltip text={"平地のフルマラソン完走タイム（参考）を入力してください\nこれを元に走力を自動調整します\nシミュレーションの結果、関門に間に合わないような場合は、完走タイムを速めにしてみてください\nそのかわりレース本番では普段より速く走る努力をしましょう"} />
                </label>
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
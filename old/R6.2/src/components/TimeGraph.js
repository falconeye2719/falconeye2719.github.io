import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import './TimeGraph.css'; // import を追加

Chart.register(...registerables);

const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const remainingSecondsAfterHours = totalSeconds % 3600;
    const minutes = Math.floor(remainingSecondsAfterHours / 60);
    const seconds = remainingSecondsAfterHours % 60;

    return `${totalHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


const TimeGraph = ({ results, pointsData, appliedManualPoints, elapsedTime }) => {
    const chartRef = useRef(null);
    const [highlightPointsData, setHighlightPointsData] = useState([]);
    const [totalTime, setTotalTime] = useState('');
    const [totalElevationGain, setTotalElevationGain] = useState(0);

    const finishPoint = useMemo(() => pointsData.find(p => p.区分 === 'FINISH'), [pointsData]);
    const finishResult = useMemo(() => results[pointsData.findIndex(p => p.区分 === 'FINISH')], [results, pointsData]);

    useEffect(() => {
        const newHighlightPointsData = [];
        appliedManualPoints.forEach(manualPoint => {
            const manualDistance = parseFloat(manualPoint.distance);
            if (!isNaN(manualDistance)) {
                let closestIndex = -1;
                let minDifference = Infinity;

                pointsData.forEach((point, index) => {
                    const difference = Math.abs(point.cumulative_distance - manualDistance);
                    if (difference < minDifference) {
                        minDifference = difference;
                        closestIndex = index;
                    } else if (difference === minDifference && point.cumulative_distance > manualDistance ) {
                        closestIndex = index;
                    }
                });

                if (closestIndex !== -1 && results[closestIndex]) {
                    newHighlightPointsData.push({
                        x: pointsData[closestIndex].cumulative_distance,
                        y: results[closestIndex].elevation,
                        label: manualPoint.name || 'ステーション',
                        gateTime: manualPoint.gateTime, // ★ 関門時間
                    });
                }
            }
        });
        setHighlightPointsData(newHighlightPointsData);
    }, [appliedManualPoints, results, pointsData, setHighlightPointsData]);

    useEffect(() => {
        if (elapsedTime !== undefined) {
            setTotalTime(formatTime(elapsedTime));
        } else {
            setTotalTime('');
        }

        let elevationGain = 0;
        for (let i = 1; i < results.length; i++) {
            const elevationDifference = results[i].elevation - results[i - 1].elevation;
            if (elevationDifference > 0) {
                elevationGain += elevationDifference;
            }
        }
        setTotalElevationGain(elevationGain);
    }, [results, elapsedTime]);


    const chartData = useMemo(() => {
        return {
            labels: results.map((_, index) => pointsData[index]?.cumulative_distance),
            datasets: [
                {
                    label: '標高',
                    data: results.map((result, index) => ({
                        x: pointsData[index]?.cumulative_distance,
                        y: result?.elevation
                    })),
                    borderColor: 'rgba(0, 123, 255, 1)', // 青色の線
                    backgroundColor: 'rgba(0, 123, 255, 0.2)', // 青色の塗りつぶし
                    fill: true,
                    yAxisID: 'elevation-axis',
                    pointRadius: 1,
                    pointBackgroundColor: 'rgba(0, 123, 255, 1)', // 青色の点
                    pointBorderColor: 'rgba(0, 123, 255, 1)', // 青色の点の枠線
                    borderWidth: 1,
                    tension: 0.3,
                    order: 1,
                },
                ...highlightPointsData.length > 0 ? [{
                    label: 'エイド',
                    data: highlightPointsData.map(p => ({ x: p.x, y: p.y })),
                    borderColor: 'rgba(0, 0, 255, 0.7)',
                    backgroundColor: 'rgba(0, 0, 255, 0.7)',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'circle',
                    showLine: false,
                    yAxisID: 'elevation-axis',
                    order: 0,
                    pointBackgroundColor: (context) => highlightPointsData[context.dataIndex].gateTime ? 'red' : 'rgba(0, 0, 255, 0.7)',
                    pointBorderColor: (context) => highlightPointsData[context.dataIndex].gateTime ? 'red' : 'rgba(0, 0, 255, 0.7)',
                }] : [],
                ...(finishPoint && finishResult ? [{
                    label: 'FINISH',
                    data: [{ x: finishPoint.cumulative_distance, y: finishResult.elevation }],
                    borderColor: 'gold',
                    backgroundColor: 'gold',
                    pointBorderColor: 'blue',
                    pointBorderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    pointStyle: 'rectRot',
                    showLine: false,
                    yAxisID: 'elevation-axis',
                    order: 0,
                }] : []),
            ],
        };
    }, [results, pointsData, highlightPointsData, finishPoint, finishResult]);

    const chartOptions = useMemo(() => ({
        aspectRatio: 5, // ★ 縦横比を 1:5 に設定 ★
        scales: {
            x: {
                title: {
                    display: true,
                    text: '累積距離 (km)',
                },
                type: 'linear',
                ticks: {
                    callback: function (value) {
                        return value;
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: '標高 (m)',
                },
                beginAtZero: false,
                ticks: {
                    stepSize: 50,
                },
                id: 'elevation-axis',
            },
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: (context) => {
                        let label = context.dataset.label || '';
                        const tooltipLines = []; // ★ ここで初期化 ★
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('ja-JP', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(context.parsed.y);
                        }
                        if (context.dataset.label === '標高') {
                            label += ' m';
                        } else if (context.dataset.label === 'エイド') {
                            const manualPoint = appliedManualPoints.find(mp => Math.abs(parseFloat(mp.distance) - context.parsed.x) < 0.1);
                            const closestPoint = highlightPointsData.find(p => Math.abs(p.x - context.parsed.x) < 0.01);
                            const closestPointIndex = pointsData.findIndex(p => Math.abs(p.cumulative_distance - closestPoint?.x) < 0.01);
                            if (manualPoint && closestPoint && results[closestPointIndex]) {
                                const resultData = results[closestPointIndex];
                                tooltipLines.push(`${manualPoint.type}${manualPoint.name ? `(${manualPoint.name})` : ''}`);
                                tooltipLines.push(`到着時刻: ${resultData?.arrivalTime}`);
                                tooltipLines.push(`標高: ${new Intl.NumberFormat('ja-JP', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(resultData?.elevation)} m`);
                                if (closestPoint.gateTime) {
                                    tooltipLines.push(`関門時間: ${closestPoint.gateTime}`);
                                }
                                return tooltipLines;
                            }
                            return label;
                        } else if (context.dataset.label === 'FINISH') {
                            const finishPointData = pointsData.find(p => p.区分 === 'FINISH');
                            const finishResultData = results[pointsData.findIndex(p => p.区分 === 'FINISH')];
                            if (finishPointData && finishResultData) {
                              return [
                               `FINISH地点`,
                               `到着時刻: ${finishResultData.arrivalTime}`,
                               `標高: ${new Intl.NumberFormat('ja-JP', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(finishResultData?.elevation)} m` // ★ 必要であれば追加 ★
                             ];
                            }
                            return label;
                        } else {
                            const pointInfo = pointsData[context.dataIndex];
                            if (pointInfo) {
                                label += ` (${pointInfo.name})`;
                                if (pointInfo.区分 && pointInfo.区分 !== '') {
                                    label += ` - ${pointInfo.区分}${pointInfo.区分名称 ? `(${pointInfo.区分名称})` : ''}`;
                                }
                            }
                            return label;
                        }
                    },
                    title: (context) => {
                        if (context && context[0] && context[0].parsed && context[0].parsed.x !== undefined) {
                            const distance = new Intl.NumberFormat('ja-JP', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(context[0].parsed.x);
                            const elevation = results[context[0].dataIndex]?.elevation;
                            if (elevation !== undefined) {
                                return `累積距離: ${distance} km`;
                            }
                            return `累積距離: ${distance} km`;
                        }
                        return '';
                    },
                },
            },
            legend: { // ★ legend オプションを追加 ★
                display: false, // ★ 凡例を非表示に設定 ★
            }
        },
    }), [appliedManualPoints, results, pointsData, highlightPointsData]);

    useEffect(() => {
        if (chartRef && chartRef.current) {
            const chartInstance = chartRef.current;
            chartInstance.data = { ...chartData };
            chartInstance.options = { ...chartOptions };
            chartInstance.update();
        }
    }, [chartData, chartOptions]);

    return (
        <div>
            <h2>シミュレーション結果</h2>
            <div style={{ display: 'flex',  justifyContent: 'center', marginBottom: '1em' }}>
              {elapsedTime !== undefined && <p style={{ margin: '0 3em 0 0' }}>総所要時間: {formatTime(elapsedTime)}</p>}
              {totalElevationGain > 0 && <p style={{ margin: 0 }}>累積標高 (+D): {totalElevationGain.toFixed(0)} m</p>}
            </div>
            <Line data={chartData} options={chartOptions} ref={chartRef} />
        </div>
    );
};

export default TimeGraph;

// TimeGraph.js
import React, { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const TimeGraph = ({ results, startTime, interval, cumulativeDistances, pointsData, manualPoints }) => {
    const chartRef = useRef(null);

    useEffect(() => {
        if (chartRef && chartRef.current && results.length > 0) {
            const chartInstance = chartRef.current;
            const existingDatasets = chartInstance.data.datasets || [];

            const highlightDatasetIndex = existingDatasets.findIndex(dataset => dataset.label === '手動入力地点');
            if (highlightDatasetIndex !== -1) {
                existingDatasets.splice(highlightDatasetIndex, 1);
            }

            const highlightPointsData = [];
            manualPoints.forEach(manualPoint => {
                const manualDistance = parseFloat(manualPoint.distance);
                if (!isNaN(manualDistance)) {
                    let closestIndex = -1;
                    let minDifference = Infinity;

                    pointsData.forEach((point, index) => {
                        const difference = Math.abs(point.cumulative_distance - manualDistance);
                        if (difference < minDifference) {
                            minDifference = difference;
                            closestIndex = index;
                        }
                    });

                    if (closestIndex !== -1) {
                        highlightPointsData.push({
                            x: pointsData[closestIndex].cumulative_distance, // 横軸は距離
                            y: results[closestIndex].elevation,
                            label: manualPoint.name || '手動入力地点',
                            originalIndex: closestIndex,
                        });
                    }
                }
            });

            const datasets = [
                {
                    label: '標高',
                    data: results.map((result, index) => ({ x: pointsData[index].cumulative_distance, y: result.elevation })), // 横軸は距離
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: true,
                    yAxisID: 'elevation-axis',
                    pointRadius: 1,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                    pointBorderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    tension: 0.1,
                    order: 1,
                },
            ];

            if (highlightPointsData.length > 0) {
                datasets.push({
                    label: '手動入力地点',
                    data: highlightPointsData.map(p => ({ x: p.x, y: p.y })),
                    borderColor: 'rgba(0, 0, 255, 0.7)', // 青色
                    backgroundColor: 'rgba(0, 0, 255, 0.7)', // 青色
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'circle',
                    showLine: false,
                    yAxisID: 'elevation-axis',
                    order: 0, // 標高グラフより前面に表示
                });
            }

            chartInstance.data.datasets = datasets;
            chartInstance.options.scales.x = {
                title: {
                    display: true,
                    text: '累積距離 (km)',
                },
                type: 'linear',
                ticks: {
                    callback: function (value) {
                        return value; // 数値をそのまま表示
                    }
                }
            };
            chartInstance.options.scales.y = {
                title: {
                    display: true,
                    text: '標高 (m)',
                },
                // ★ 追加: 縦軸の最小値と最大値をデータに基づいて自動設定 ★
                beginAtZero: false,
            };
            chartInstance.options.plugins.tooltip.callbacks.label = (context) => {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('ja-JP', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(context.parsed.y);
                }
                if (context.dataset.label === '標高') {
                    label += ' m';
                } else if (context.dataset.label === '手動入力地点') {
                    const manualPoint = manualPoints.find(mp => Math.abs(parseFloat(mp.distance) - context.parsed.x) < 0.1);
                    const closestPointIndex = highlightPointsData.find(p => Math.abs(p.x - context.parsed.x) < 0.01)?.originalIndex; // 該当するトラックポイントのインデックスを取得
                    if (manualPoint && closestPointIndex !== undefined) {
                        const resultData = results[closestPointIndex];
                        return [
                            `${manualPoint.type}${manualPoint.name ? `(${manualPoint.name})` : ''}`,
                            `標高: ${resultData?.elevation} m`,
                            `到着時刻: ${resultData?.arrivalTime}`
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
            };
            chartInstance.options.plugins.tooltip.callbacks.title = (context) => {
                if (context && context[0] && context[0].parsed && context[0].parsed.x !== undefined) {
                    return `累積距離: ${new Intl.NumberFormat('ja-JP', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(context[0].parsed.x)} km`;
                }
                return '';
            };

            chartInstance.update();
        }
    }, [results, startTime, interval, cumulativeDistances, pointsData, manualPoints]);

    const chartData = {
        labels: results.map(result => result.arrivalTime), // これはもう使わない
        datasets: [], // ここは useEffect で動的に設定
    };

    const chartOptions = {
        scales: {
            x: {
                title: {
                    display: true,
                    text: '累積距離 (km)',
                },
                type: 'linear',
                ticks: {
                    callback: function (value) {
                        return value; // 数値をそのまま表示
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: '標高 (m)',
                },
                // ★ 追加: 縦軸の最小値と最大値をデータに基づいて自動設定 ★
                beginAtZero: false,
            },
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: () => '', // ここは useEffect で動的に設定
                },
            },
        },
    };

    return (
        <div>
            <h2>標高の推移</h2>
            <Line data={chartData} options={chartOptions} ref={chartRef} />
        </div>
    );
};

export default TimeGraph;
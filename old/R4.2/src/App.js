import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import PointInfo from './components/PointInfo';
import GPSImport from './components/GPSImport';
import PaceInput from './components/PaceInput';
import TimeGraph from './components/TimeGraph';
import ResultTable from './components/ResultTable';
import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import isEqual from 'lodash/isEqual';
import './App.css';
import { PuffLoader } from 'react-spinners';

const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const remainingSecondsAfterHours = totalSeconds % 3600;
    const minutes = Math.floor(remainingSecondsAfterHours / 60);
    const seconds = remainingSecondsAfterHours % 60;

    return `<span class="math-inline"><span class="math-inline">\\\{totalHours\.toString\(\)\.padStart\(2, '0'\)\\\}</span>:</span><span class="math-inline">\{minutes\.toString\(\)\.padStart\(2, '0'\)\}\:</span>{seconds.toString().padStart(2, '0')}`;
};

const toRadians = Math.PI / 180;
const R = 6371e3; // 地球の半径 (メートル)

// ★ fast-xml-parser のインスタンスを作成 ★
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName, jPath, isLeaf, isAttribute) => {
        if (tagName === 'trkpt') return true;
        return false;
    }
});

function App() {
    const [pointsData, setPointsData] = useState([]);
    const [startTime, setStartTime] = useState('');
    const [averagePace, setAveragePace] = useState('');
    const [itraIndex, setItraIndex] = useState(''); // ★ ITRAパフォーマンスインデックスの state
    const [simulationResult, setSimulationResult] = useState([]);
    const [cumulativeDistancesForGraph, setCumulativeDistancesForGraph] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [manualPoints, setManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '' }]);
    const [draftManualPoints, setDraftManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '', restTime: '' }]);
    const [appliedManualPoints, setAppliedManualPoints] = useState([]); // ★ 初期値を設定 ★
    const previousPointsDataRef = useRef(null);
    const [manualPointsApplied, setManualPointsApplied] = useState(false);
    const [firstKmArrivalTime, setFirstKmArrivalTime] = useState(null);
    const [gpxFileName, setGpxFileName] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [gpxFileLoaded, setGpxFileLoaded] = useState(false);
    const [isGPXLoading, setIsGPXLoading] = useState(false);

    // ファイル選択時にローディングを開始
    const handleFileSelected = useCallback(() => {
        setIsGPXLoading(true);
        setGpxFileLoaded(false); // ★ ファイル選択時に false に設定 ★
        setPointsData([]);
        setSimulationResult([]);
        setTableData([]);
        setFirstKmArrivalTime(null);
    }, []);

    // GPX読み込み完了後にローディングを終了
    const finishLoading = useCallback(() => {
        setIsGPXLoading(false);
    }, []);

    // グローバルカーソル変更：loading-cursorクラスの付け外し
    useEffect(() => {
        const className = 'loading-cursor';
        const htmlElem = document.documentElement;
        const bodyElem = document.body;
        const rootElem = document.getElementById('root'); // root要素を取得

        // rootElemが存在する場合のみクラスを操作する
        if (rootElem) {
            if (isGPXLoading) {
                htmlElem.classList.add(className);
                bodyElem.classList.add(className);
                rootElem.classList.add(className); // root要素にもクラスを追加
            } else {
                htmlElem.classList.remove(className);
                bodyElem.classList.remove(className);
                rootElem.classList.remove(className); // root要素からもクラスを削除
            }
        }
    }, [isGPXLoading]);

    // 距離計算
    const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
        const φ1 = lat1 * toRadians;
        const φ2 = lat2 * toRadians;
        const Δφ = (lat2 - lat1) * toRadians;
        const Δλ = (lon2 - lon1) * toRadians;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c;
        return distance / 1000;
    }, []);

    const generateStorageKey = useCallback((gpxFileName) => {
        if (!gpxFileName) return null;
        // より堅牢にするなら、GPXファイルの内容からハッシュ値を生成するなどの処理を追加
        return `${gpxFileName}_manual_points_v2`; // キーをバージョン管理しておくと後々便利
    }, []);

    const loadManualPoints = useCallback((key) => {
        if (key) {
            const storedPoints = localStorage.getItem(key);
            if (storedPoints) {
                try {
                    const parsedPoints = JSON.parse(storedPoints);
                    setManualPoints(parsedPoints);
                    setDraftManualPoints(parsedPoints.map(p => ({ ...p })));
                    setAppliedManualPoints(parsedPoints.map(p => ({ ...p })));
                } catch (error) {
                    console.error("手動地点情報の読み込みエラー:", error);
                }
            } else {
                // 保存された地点情報がない場合は初期状態に戻す
                setManualPoints([{ id: uuidv4(), distance: '', type: '', name: '' }]);
                setDraftManualPoints([{ id: uuidv4(), distance: '', type: '', name: '' }]);
                setAppliedManualPoints([]);
            }
        }
    }, [setManualPoints, setDraftManualPoints, setAppliedManualPoints]);

    const saveManualPoints = useCallback((gpxFileName, currentManualPoints) => {
        const storageKey = generateStorageKey(gpxFileName);
        if (storageKey) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(currentManualPoints));
                setFeedbackMessage('地点情報を保存しました');
                setTimeout(() => setFeedbackMessage(''), 3000);
            } catch (error) {
                console.error("手動地点情報の保存エラー:", error);
                setFeedbackMessage('保存に失敗しました');
                setTimeout(() => setFeedbackMessage(''), 3000);
            }
        }
    }, [generateStorageKey, setFeedbackMessage]);

    // GPX読み込みハンドラ (fast-xml-parser を使用)
    const handleGPSDataImport = useCallback(async (gpxData, fileName) => {
        setGpxFileName(fileName);
        setGpxFileLoaded(true);
        setIsGPXLoading(true); // GPXデータ処理開始時にローディング開始
        const storageKey = generateStorageKey(fileName);
        loadManualPoints(storageKey); // ★ ここで読み込み処理を実行 ★

        if (gpxData) {
            try {
                const result = parser.parse(gpxData);
                let trackPoints = result?.gpx?.trk?.trkseg?.trkpt || [];
                if (!Array.isArray(trackPoints)) {
                    // trackPoints が単一のオブジェクトの場合、配列に変換
                    trackPoints = trackPoints ? [trackPoints] : [];
                }
                if (trackPoints.length === 0) {
                    alert("GPXファイルにトラックポイントが含まれていません。");
                    setIsGPXLoading(false); // データなしの場合もローディング終了
                    return;
                }

                const newPointsData = [];
                let cumulativeDistance = 0;
                let previousPoint = null;

                for (let i = 0; i < trackPoints.length; i++) {
                    const trkpt = trackPoints[i];
                    const latitude = parseFloat(trkpt["@_lat"]); // 属性は @_ プレフィックス付き
                    const longitude = parseFloat(trkpt["@_lon"]);
                    const elevation = parseInt(trkpt?.ele); // 単一要素は直接アクセス
                    const time = trkpt?.time;

                    let sectionDistance = 0;
                    let sectionGradient = 0;

                    if (previousPoint) {
                        const distance = calculateDistance(previousPoint.latitude, previousPoint.longitude, latitude, longitude);
                        sectionDistance = distance;
                        cumulativeDistance += distance;
                        if (previousPoint.elevation !== null && elevation !== null && distance > 0) {
                            const elevationChange = elevation - previousPoint.elevation;
                            const distanceInMeters = distance * 1000;
                            sectionGradient = (elevationChange / distanceInMeters) * 100;
                        }
                    }
                    newPointsData.push({
                        id: i,
                        point_type: "GPSトラックポイント",
                        name: `トラックポイント ${i + 1}`,
                        cumulative_distance: cumulativeDistance,
                        section_distance: sectionDistance,
                        elevation: elevation,
                        section_gradient: sectionGradient,
                        surface_type: "推定",
                        arrival_time: time ? new Date(time).toLocaleTimeString() : null,
                        rest_time: undefined,
                        latitude: latitude,
                        longitude: longitude,
                        timestamp: time,
                        区分: '',
                        区分名称: '',
                        manual: false
                    });

                    previousPoint = { latitude, longitude, elevation };
                }

                if (newPointsData.length > 0) {
                    newPointsData[0].cumulative_distance = 0;
                    newPointsData[0].区分 = 'START';
                    if (newPointsData.length > 1) {
                        newPointsData[newPointsData.length - 1].区分 = 'FINISH';
                    }
                }

                setPointsData(newPointsData);
                setGpxFileLoaded(true); // ★ GPXデータ処理完了後に true に設定 ★
                setIsGPXLoading(false); // GPXデータの処理が完了したら、ローディングを終了させる
                
                // ★ gpxFileLoaded が true になってから handleApplyManualPoints を呼び出す ★
                if (gpxFileLoaded) {
                  handleApplyManualPoints();
                }
            } catch (error) {
                console.error("GPXファイルの解析エラー:", error);
                alert("GPXファイルの解析に失敗しました。");
                setIsGPXLoading(false); // エラー時にもローディング終了
            }
        } else {
            console.log("GPXデータのインポートがキャンセルされました。");
            setGpxFileLoaded(false);
            setIsGPXLoading(false); // キャンセル時もローディング終了
        }
    }, [calculateDistance, setPointsData, loadManualPoints, setGpxFileName, setGpxFileLoaded, generateStorageKey]);


    const handleStartTimeChange = useCallback((event) => {
        setStartTime(event.target.value);
    }, []);

    const handleAveragePaceChange = useCallback((event) => {
        setAveragePace(event.target.value);
    }, []);

    const handleItraIndexChange = useCallback((event) => {
        const value = event.target.value;
        const numericValue = value.replace(/[^0-9]/g, '');
        if (numericValue === '' || (parseInt(numericValue, 10) >= 0 && parseInt(numericValue, 10) <= 1000)) {
            setItraIndex(numericValue);
        }
    }, [setItraIndex]);

    const handleDraftManualPointChange = useCallback((index, field, value) => {
        setDraftManualPoints(prevPoints => {
            const updatedPoints = [...prevPoints];
            updatedPoints[index] = { ...updatedPoints[index], [field]: value };
            return updatedPoints;
        });
    }, []);

    const addManualPoint = useCallback(() => {
        setDraftManualPoints(prevPoints => [...prevPoints, { id: uuidv4(), distance: '', type: '', name: '', restTime: '' }]);
    }, []);

    const removeManualPoint = useCallback((id) => {
        setDraftManualPoints(prevPoints => prevPoints.filter(point => point.id !== id));
    }, []);

    // ★ 新しい行を追加するハンドラー関数 ★
    const handleAddManualPointAt = useCallback((index) => {
        setDraftManualPoints(prevPoints => {
            const newPoints = [...prevPoints];
            newPoints.splice(index + 1, 0, { id: uuidv4(), distance: '', type: '', name: '', restTime: '' });
            return newPoints;
        });
    }, []);

    const applyManualPointsToPointsData = useCallback((currentPointsData, currentManualPoints) => {
        const newPointsData = currentPointsData.map(point => ({ ...point }));
        currentManualPoints.forEach(manualPoint => {
            const distance = parseFloat(manualPoint.distance);
            if (!isNaN(distance)) {
                let closestIndex = -1;
                let minDifference = Infinity;

                newPointsData.forEach((point, index) => {
                    const difference = Math.abs(point.cumulative_distance - distance);
                    if (difference < minDifference) {
                        minDifference = difference;
                        closestIndex = index;
                    } else if (difference === minDifference && point.cumulative_distance > distance) {
                        closestIndex = index;
                    }
                });

                if (closestIndex !== -1) {
                    newPointsData[closestIndex].区分 = manualPoint.type;
                    newPointsData[closestIndex].区分名称 = manualPoint.name;
                    newPointsData[closestIndex].manual = true;
                    newPointsData[closestIndex].restTime = manualPoint.restTime; // ★ restTime をコピー ★
                }
            }
        });

        if (newPointsData.length > 0) {
            newPointsData[0].区分 = 'START';
            if (newPointsData.length > 1) {
                newPointsData[newPointsData.length - 1].区分 = 'FINISH';
            }
        }
        return newPointsData;
    }, []);

    const handleApplyManualPoints = useCallback(() => {
     if (!gpxFileName) {
      alert("GPXファイルが読み込まれていません。");
      return;
     }
     saveManualPoints(gpxFileName, draftManualPoints);
     setManualPoints(draftManualPoints.map(p => ({ ...p })));
     setAppliedManualPoints(draftManualPoints.map(p => ({ ...p })));
     setManualPointsApplied(true);
     setPointsData(prevPointsData => applyManualPointsToPointsData(prevPointsData, draftManualPoints));
    }, [gpxFileName, draftManualPoints, saveManualPoints, applyManualPointsToPointsData]);
 
    const updatedPointsDataMemo = useMemo(() => {
        return pointsData.map(point => ({ ...point }));
    }, [pointsData]); // ★ draftManualPoints を依存配列に追加 ★

    useEffect(() => {
        // GPXデータが読み込まれた直後、または pointsData が空になった場合に初期化処理を行う
        if (gpxFileLoaded && pointsData.length > 0 && !manualPointsApplied) {
            const initialPointsData = pointsData.map(point => ({ ...point }));
            if (initialPointsData.length > 0) {
                initialPointsData[0].区分 = 'START';
                if (initialPointsData.length > 1) {
                    initialPointsData[initialPointsData.length - 1].区分 = 'FINISH';
                }
                if (!isEqual(previousPointsDataRef.current, initialPointsData)) {
                    setPointsData(initialPointsData);
                    previousPointsDataRef.current = initialPointsData;
                }
            }
        } else if (pointsData.length === 0 && previousPointsDataRef.current?.length > 0) {
            setPointsData([]);
            previousPointsDataRef.current = null;
        }
//        setManualPointsApplied(false); // ★ 処理の最後にフラグをリセット ★
    }, [gpxFileLoaded, pointsData, isEqual, manualPointsApplied]);


// ITRA Performance Indexによるペース補正関数（30km経過後にペース低下）
const calculatePaceWithITRA = useCallback((basePaceInSecondsPerKm, itraIndexValue, currentDistanceInKm, totalDistanceInKm) => {
    let modifiedPace = basePaceInSecondsPerKm;
    const index = itraIndexValue;

    // ITRA Indexに応じた最大失速率設定
    let maxPenalty;
    if (index > 825) {
        maxPenalty = 0.05;        // 最大5%失速
    } else if (index > 725) {
        maxPenalty = 0.10;        // 最大10%失速
    } else if (index > 550) {
        maxPenalty = 0.15;        // 最大15%失速
    } else if (index > 450) {
        maxPenalty = 0.40;        // 最大40%失速
    } else if (index > 300) {
        maxPenalty = 0.60;        // 最大60%失速
    } else {
        maxPenalty = 0.70;        // 最大70%失速
    }

    const distanceToStartPenalty = 30; // ペース低下を開始する距離 (km)

    if (!isNaN(index) && currentDistanceInKm > distanceToStartPenalty && totalDistanceInKm > distanceToStartPenalty) {
        // ペース低下の進行度合いを計算 (30km以降の走行距離の割合)
        const distanceAfterThreshold = currentDistanceInKm - distanceToStartPenalty;
        const remainingDistanceAfterThreshold = totalDistanceInKm - distanceToStartPenalty;
        const penaltyFactor = Math.min(1, distanceAfterThreshold / remainingDistanceAfterThreshold); // 0〜1

        const latePenalty = maxPenalty * penaltyFactor;
        modifiedPace *= (1 + latePenalty);
    }

    return modifiedPace;
}, []);

    const handleSimulate = useCallback(() => {
    
        if (!manualPointsApplied) {
          alert("エイド情報を適用してからシミュレーションを実行してください。");
          return;
        }

        // ★ シミュレーション前に手動ポイントを適用 ★
//        const pointsWithManual = applyManualPointsToPointsData(updatedPointsDataMemo, draftManualPoints);
//        setPointsData(pointsWithManual);

        if (!startTime || !averagePace || pointsData.length === 0) {
            alert("START時間、平均ペース、GPXデータが入力されていません。");
            return;
        }

        const [startHours, startMinutes] = startTime.split(':').map(Number);
        if (isNaN(startHours) || isNaN(startMinutes) || startHours < 0 || startHours > 23 || startMinutes < 0 || startMinutes > 59) {
            alert("START時間の形式が正しくありません (HH:MM)。");
            return;
        }

        const [paceMinutes, paceSeconds] = averagePace.split(':').map(Number);
        if (isNaN(paceMinutes) || isNaN(paceSeconds) || paceMinutes < 0 || paceMinutes > 59 || paceSeconds < 0 || paceSeconds > 59) {
            alert("平均ペースの形式が正しくありません (分:秒)。");
            return;
        }
        const basePaceInSecondsPerKm = paceMinutes * 60 + paceSeconds;
        const itraIndexValue = parseInt(itraIndex, 10);
        const totalDistance = pointsData.length > 0 ? pointsData[pointsData.length - 1].cumulative_distance : 0;

        const start = new Date();
        start.setHours(startHours);
        start.setMinutes(startMinutes);
        start.setSeconds(0);
        start.setMilliseconds(0);
        const startTimeInMilliseconds = start.getTime(); // 開始時刻のタイムスタンプ

        let currentTime = new Date(start);
        const newResults = [];
        const newCumulativeDistances = [];
        const newTableData = [];
        let previousPointWithNonEmptyKubun = null; // ★直前の区分が空白でないポイントを保持
        let reachedFirstKm = false;
        let firstKmArrivalTimeTemp = null;
        let elapsedTimeFromStart = 0; // 経過時間（ミリ秒）

        for (let i = 0; i < pointsData.length; i++) {
            const currentPoint = pointsData[i];
//            const distanceRatio = totalDistance > 0 ? currentPoint.cumulative_distance / totalDistance : 0;
            let currentPaceInSecondsPerKm = calculatePaceWithITRA(
                 basePaceInSecondsPerKm,
                 itraIndexValue, 
                 currentPoint.cumulative_distance, // ★ 現在の累積距離を渡す ★
                 totalDistance                  // ★ 総距離を渡す ★
            );

            let sectionDistanceForTable = '0.00';
            if (currentPoint.区分 !== '' && previousPointWithNonEmptyKubun) {
             sectionDistanceForTable = (currentPoint.cumulative_distance - previousPointWithNonEmptyKubun.cumulative_distance).toFixed(1);
            } else if (i === 0) {
             sectionDistanceForTable = '0.0';
            }

            // ★ 勾配によるペース補正（パーセンテージで設定） ★
            const gradient = currentPoint.section_gradient || 0;
            let gradientBasedPenaltyPercentage = 0;

            if (gradient > 2) { // 上り坂（勾配が2%より大きい場合）
                if (gradient <= 5) {
                    gradientBasedPenaltyPercentage = 0.20; // 20%遅くする
                } else if (gradient <= 10) {
                    gradientBasedPenaltyPercentage = 0.40; // 40%遅くする
                } else if (gradient <= 15) {
                    gradientBasedPenaltyPercentage = 0.80; // 80%遅くする
                } else if (gradient <= 20) {
                    gradientBasedPenaltyPercentage = 1.60; // 160%遅くする
                } else if (gradient <= 25) {
                    gradientBasedPenaltyPercentage = 2.00; // 200%遅くする
                } else {
                    gradientBasedPenaltyPercentage = 3.00; // 300%遅くする
                }
            } else if (gradient < -5) { // 下り坂
                if (gradient <= -15) {
                    gradientBasedPenaltyPercentage = -0.03; // 10%速くする
                } else if (gradient <= -10) {
                    gradientBasedPenaltyPercentage = -0.03; // 7%速くする
                } else { // (gradient > -10 && gradient <= -5)
                    gradientBasedPenaltyPercentage = -0.03; // 3%速くする
                }
            } else { // 緩やかな勾配または平坦
                gradientBasedPenaltyPercentage = 0;
            }
            currentPaceInSecondsPerKm *= (1 + gradientBasedPenaltyPercentage); // パーセンテージを適用

console.log(`Index: ${i}, Gradient: ${gradient}`);


            const travelTimeInSeconds = currentPoint.section_distance * currentPaceInSecondsPerKm;

            if (i > 0) {
                elapsedTimeFromStart += travelTimeInSeconds * 1000;
                if (currentPoint.manual && currentPoint.restTime) {
                    elapsedTimeFromStart += parseInt(currentPoint.restTime, 10) * 60 * 1000;
                }
            }

            const arrivalTime = new Date(startTimeInMilliseconds + elapsedTimeFromStart);
            const arrivalTimeFormatted = arrivalTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const cumulativeDistance = currentPoint.cumulative_distance;
            const elevation = parseInt(currentPoint.elevation);
            const previousCumulativeDistance = i > 0 ? pointsData[i - 1].cumulative_distance : 0;
            const sectionDistance = (cumulativeDistance - previousCumulativeDistance).toFixed(2);

            newResults.push({
                name: currentPoint.name,
                arrivalTime: arrivalTimeFormatted, // こちらは表示用として残す
                cumulativeDistance: cumulativeDistance,
                elevation: elevation,
                section_gradient: gradient,
                区分: currentPoint.区分,
                区分名称: currentPoint.区分名称,
                restTime: currentPoint.restTime,
                elapsedTime: elapsedTimeFromStart, // 経過時間を保存
            });
            newCumulativeDistances.push(cumulativeDistance);
            newTableData.push({
                区分: currentPoint.区分,
                区分名称: currentPoint.区分名称,
                累積距離: cumulativeDistance.toFixed(1),
                区間距離: sectionDistanceForTable,
                標高: elevation,
                到着時刻: arrivalTimeFormatted.slice(0, 5), // HH:MM形式に修正
                休憩時間: currentPoint.restTime,
                経過時間: formatTime(elapsedTimeFromStart), // テーブルにも経過時間を表示
            });

            if (currentPoint.区分 !== '') {
             previousPointWithNonEmptyKubun = currentPoint;
            }

            if (!reachedFirstKm && cumulativeDistance >= 1) {
                firstKmArrivalTimeTemp = arrivalTimeFormatted;
                reachedFirstKm = true;
            }
        }

        setFirstKmArrivalTime(firstKmArrivalTimeTemp);
        setCumulativeDistancesForGraph(newCumulativeDistances);
        setSimulationResult(newResults);
        setTableData(newTableData.filter(item => item.区分 !== '')); // 区分が空白でないもののみ表示
        setManualPointsApplied(false); // ★ シミュレーション後にフラグをリセット ★
    }, [startTime, averagePace, updatedPointsDataMemo, manualPoints, setCumulativeDistancesForGraph, setSimulationResult,
        setTableData, applyManualPointsToPointsData, pointsData, itraIndex, calculatePaceWithITRA]);

    const pointsDataMemo = useMemo(() => pointsData, [pointsData]);
    const simulationResultMemo = useMemo(() => simulationResult, [simulationResult]);
    const cumulativeDistancesForGraphMemo = useMemo(() => cumulativeDistancesForGraph, [cumulativeDistancesForGraph]);

    return (
        <div className="App">
            <header className="App-header">
                <h1>トレイルランニングシミュレータ</h1>
            </header>
            <main>
                {feedbackMessage && <div className="feedback-message">{feedbackMessage}</div>}
                <GPSImport onDataImport={handleGPSDataImport} onFileSelected={handleFileSelected} />
                {isGPXLoading && (
                    <div className="loading-container">
                        <PuffLoader color="#00BFFF" height={80} width={80} />
                        <p>GPXファイルを読み込み中...</p>
                    </div>
                )}
                <div>
                    <h2>エイド情報入力</h2>
                    {draftManualPoints.map((point, index) => (
                        <div key={point.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', justifyContent: 'center' }}>
                            {/* ★ 追加ボタン ★ */}
                            <button type="button" onClick={() => handleAddManualPointAt(index)} style={{ marginLeft: '5px' }}>＋</button>
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>距離 (km):</label>
                                <input
                                    type="number"
                                    value={point.distance}
                                    onChange={(e) => handleDraftManualPointChange(index, 'distance', e.target.value)}
                                    style={{ width: '80px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>区分:</label>
                                <input
                                    type="text"
                                    value={point.type}
                                    onChange={(e) => handleDraftManualPointChange(index, 'type', e.target.value)}
                                    style={{ width: '100px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>区分名:</label>
                                <input
                                    type="text"
                                    value={point.name}
                                    onChange={(e) => handleDraftManualPointChange(index, 'name', e.target.value)}
                                    style={{ width: '150px' }}
                                />
                            </div>
                            {/* ★ 休憩時間入力欄 ★ */}
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>休憩 (分):</label>
                                <input
                                    type="number"
                                    value={point.restTime}
                                    onChange={(e) => handleDraftManualPointChange(index, 'restTime', e.target.value)}
                                    style={{ width: '60px' }}
                                />
                            </div>
                            {draftManualPoints.length > 1 && (
                                <button type="button" onClick={() => removeManualPoint(point.id)} style={{ marginLeft: '5px' }}>削除</button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={handleApplyManualPoints} disabled={!gpxFileLoaded}>適用</button>
                    {!gpxFileLoaded && <p className="warning-message">GPXファイルを読み込んでから適用してください。</p>}
                </div>
                <PaceInput
                    startTime={startTime}
                    averagePace={averagePace}
                    onStartTimeChange={handleStartTimeChange}
                    onAveragePaceChange={handleAveragePaceChange}
                    onSimulate={handleSimulate}
                    itraIndex={itraIndex} // ★ ITRA Index を PaceInput に渡す
                    onItraIndexChange={handleItraIndexChange} // ★ ITRA Index の変更ハンドラを渡す
                />
                {simulationResult.length > 0 && (
                    <>
                        <TimeGraph
                            results={simulationResultMemo}
                            startTime={startTime}
                            interval={10}
                            cumulativeDistances={cumulativeDistancesForGraphMemo}
                            pointsData={pointsDataMemo}
                            appliedManualPoints={appliedManualPoints}
                            elapsedTime={simulationResultMemo.length > 0 ? simulationResultMemo[simulationResultMemo.length - 1].elapsedTime : 0} // 総経過時間を渡す
                        />
                        <ResultTable data={tableData} />
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
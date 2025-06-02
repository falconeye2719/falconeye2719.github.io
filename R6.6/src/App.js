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
import { smoothElevation } from './utils/elevationUtils';

const APP_VERSION = "6.6"; // 例: バージョン番号をここに記述

const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalHours = Math.floor(totalSeconds / 3600);
    const remainingSecondsAfterHours = totalSeconds % 3600;
    const minutes = Math.floor(remainingSecondsAfterHours / 60);
    const seconds = remainingSecondsAfterHours % 60;
    return (
    <span className="math-inline">
        {totalHours.toString().padStart(2, '0')}:
        {minutes.toString().padStart(2, '0')}:
        {seconds.toString().padStart(2, '0')}
    </span>
    );
//    return `<span class="math-inline"><span class="math-inline">\\\{totalHours\.toString\(\)\.padStart\(2, '0'\)\\\}</span>:</span><span class="math-inline">\{minutes\.toString\(\)\.padStart\(2, '0'\)\}\:</span>{seconds.toString().padStart(2, '0')}`;
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
//    const [averagePace, setAveragePace] = useState('');
    const [itraIndex, setItraIndex] = useState(''); // ★ ITRAパフォーマンスインデックスの state
    const [simulationResult, setSimulationResult] = useState([]);
    const [cumulativeDistancesForGraph, setCumulativeDistancesForGraph] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [manualPoints, setManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '' }]);
    const [draftManualPoints, setDraftManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '', restTime: 0, gateTime: '' }]);
    const [appliedManualPoints, setAppliedManualPoints] = useState([]); // ★ 初期値を設定 ★
    const previousPointsDataRef = useRef(null);
    const [manualPointsApplied, setManualPointsApplied] = useState(false);
    const [firstKmArrivalTime, setFirstKmArrivalTime] = useState(null);
    const [gpxFileName, setGpxFileName] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [gpxFileLoaded, setGpxFileLoaded] = useState(false);
    const [isGPXLoading, setIsGPXLoading] = useState(false);
    const [flatPaceInput, setFlatPaceInput] = useState(''); // ★ フルマラソン完走タイム入力 state
    const [calculatedAveragePace, setCalculatedAveragePace] = useState(''); // ★ 計算された平均ペース state
    const [isApplyButtonFlashing, setIsApplyButtonFlashing] = useState(false); // ★ Applyボタン点滅制御 state // ★ 追加
    const [finishTime, setFinishTime] = useState(''); // ★ 追加: FINISH時間を管理するstate ★

    // ファイル選択時にローディングを開始
    const handleFileSelected = useCallback(() => {

        //        setIsGPXLoading(true);
        setGpxFileLoaded(false); // ★ ファイル選択時に false に設定 ★
        setPointsData([]);
        setSimulationResult([]);
        setTableData([]);
        setFirstKmArrivalTime(null);
//        setCalculatedAveragePace(''); // ★ ファイル選択時に計算済みペースをクリア ★
//        setFlatPaceInput(''); // ★ ファイル選択時に完走予想タイムをクリア ★
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

        // ★ ここで tableData と simulationResult をリセット ★
        setTableData([]);
        setSimulationResult([]);

        if (gpxData) {
            try {
            const result = parser.parse(gpxData);
            let trackPoints = [];
            const trks = result?.gpx?.trk;
                
            if (Array.isArray(trks)) {
                trks.forEach(trk => {
                const trksegs = trk?.trkseg;
                if (Array.isArray(trksegs)) {
                    trksegs.forEach(trkseg => {
                    if (Array.isArray(trkseg?.trkpt)) {
                        trackPoints = [...trackPoints, ...trkseg.trkpt];
                    } else if (trkseg?.trkpt) {
                        trackPoints.push(trkseg.trkpt);
                    }
                 });
                } else if (trksegs?.trkpt) {
                    if (Array.isArray(trksegs.trkpt)) {
                        trackPoints = [...trackPoints, ...trksegs.trkpt];
                    } else {
                        trackPoints.push(trksegs.trkpt);
                    }
                    }
                });
                } else if (trks) { // trk が単一オブジェクトの場合
                    const trksegs = trks?.trkseg;
                    if (Array.isArray(trksegs)) {
                        trksegs.forEach(trkseg => {
                            if (Array.isArray(trkseg?.trkpt)) {
                                trackPoints = [...trackPoints, ...trkseg.trkpt];
                            } else if (trkseg?.trkpt) {
                                trackPoints.push(trkseg.trkpt);
                            }
                        });
                    } else if (trksegs?.trkpt) {
                        if (Array.isArray(trksegs.trkpt)) {
                            trackPoints = [...trackPoints, ...trksegs.trkpt];
                        } else {
                            trackPoints.push(trksegs.trkpt);
                        }
                    }
                }
                
                if (!Array.isArray(trackPoints) || trackPoints.length === 0) {
                    alert("GPXファイルにトラックポイントが含まれていません。");
                    setIsGPXLoading(false); // データなしの場合もローディング終了
                    return;
                }
                
                // GPXデータの標高をスムージング
                const elevationArray = trackPoints.map(trkpt => parseFloat(trkpt?.ele) || 0);
                const smoothedElevations = smoothElevation(elevationArray, 1); // スムージング適用

                const newPointsData = [];
                let cumulativeDistance = 0;
                let previousPoint = null;

                for (let i = 0; i < trackPoints.length; i++) {
                    const trkpt = trackPoints[i];
                    const latitude = parseFloat(trkpt["@_lat"]); // 属性は @_ プレフィックス付き
                    const longitude = parseFloat(trkpt["@_lon"]);
                    const elevation = smoothedElevations[i]; // スムージング適用後の標高データを使用
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
                // ★ gpxFileLoaded が true になってから handleApplyManualPoints を呼び出す ★
                if (gpxFileLoaded) {
                    handleApplyManualPoints();
                }

                setPointsData(newPointsData);
                setGpxFileLoaded(true); // ★ GPXデータ処理完了後に true に設定 ★
                setIsGPXLoading(false); // GPXデータの処理が完了したら、ローディングを終了させる
                
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
    }, [calculateDistance, setPointsData, loadManualPoints, setGpxFileName, setGpxFileLoaded, generateStorageKey, setTableData, setSimulationResult]); // ★ 依存配列に setTableData と setSimulationResult を追加 ★

    const handleStartTimeChange = useCallback((event) => {
        setStartTime(event.target.value);
    }, []);

    // ★ 追加: FINISH時間変更ハンドラ ★
    const handleFinishTimeChange = useCallback((e) => {
        setFinishTime(e.target.value);
    }, []);

//    const handleAveragePaceChange = useCallback((event) => {
//        setAveragePace(event.target.value);
//    }, []);

    const handleItraIndexChange = useCallback((event) => {
        const value = event.target.value;
        const numericValue = value.replace(/[^0-9]/g, '');
        if (numericValue === '' || (parseInt(numericValue, 10) >= 0 && parseInt(numericValue, 10) <= 1000)) {
            setItraIndex(numericValue);
        }
    }, [setItraIndex]);

    const handleFlatPaceInputChange = useCallback((event) => {
        setFlatPaceInput(event.target.value);
    }, []);

    const calculatePaceFromFinishTime = useCallback(() => {
        const timeParts = flatPaceInput.split(':');
        if (timeParts.length === 2 && !isNaN(timeParts[0]) && !isNaN(timeParts[1])) {
            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);
            const totalMinutes = hours * 60 + minutes;
            const pacePerKm = totalMinutes / 42.195;
            const paceMinutes = Math.floor(pacePerKm);
            const paceSeconds = Math.round((pacePerKm - paceMinutes) * 60);
            setCalculatedAveragePace(`${paceMinutes}:${paceSeconds < 10 ? '0' : ''}${paceSeconds}`); // HTML タグを削除
        } else {
            setCalculatedAveragePace(''); // 無効な入力の場合はクリア
        }
    }, [flatPaceInput, setCalculatedAveragePace]);

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


    //applyManualPointsToPointsData
    // ✅ ユーザーが入力した エイド情報 (currentManualPoints) を pointsData に追加 する
    // ✅ 「距離」に基づいて、エイド情報を適切なポイントに適用 する
    // ✅ START (スタート地点) と FINISH (ゴール地点) を設定 する
    // ✅ リザルトテーブルでエイド情報が正しく表示できるようにする
    const applyManualPointsToPointsData = useCallback((currentPointsData, currentManualPoints) => {

        //currentPointsData のコピー (newPointsData) を作成し、元のデータを変更しないようにする。
        const newPointsData = currentPointsData.map(point => ({ ...point }));

        //currentManualPoints の各エイド情報を 1つずつ処理
        //  ✅ distance を 数値 (float) に変換 し、「エイドの距離」を取得
        //  ✅ distance が 数値でない場合 (エラー) はスキップ
        currentManualPoints.forEach(manualPoint => {
            const distance = parseFloat(manualPoint.distance);
            if (!isNaN(distance)) {
                //✅ newPointsData の中から 「エイドの距離に最も近いポイント」 を探す
                //✅ minDifference を使い、距離の差が最も小さい (closestIndex) を見つける 
                //✅ もし複数候補がある場合、より「先の距離」のポイントを選択する
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

                //✅ closestIndex にエイド情報を設定する 
                //✅ 区分 と 区分名称 にエイド名を適用 
                //✅ restTime と gateTime に休憩時間と関門時間を適用
                //✅ リザルトテーブルに正しく反映される
                if (closestIndex !== -1) {
                    newPointsData[closestIndex].区分 = manualPoint.type;
                    newPointsData[closestIndex].区分名称 = manualPoint.name;
                    newPointsData[closestIndex].manual = true;
                    newPointsData[closestIndex].restTime = manualPoint.restTime; // ★ restTime をコピー ★
                    newPointsData[closestIndex].gateTime = manualPoint.gateTime; // ★ gateTime をコピー ★
                }
            }
        });

        //✅ 最初のポイントを START (スタート地点) にする
        //✅ 最後のポイントを FINISH (ゴール地点) にする
        if (newPointsData.length > 0) {
            newPointsData[0].区分 = 'START';
            if (newPointsData.length > 1) {
                newPointsData[newPointsData.length - 1].区分 = 'FINISH';
            }
        }

        //✅ 更新された pointsData を返し、次の処理 (handleSimulate) で使用できるようにする！
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
    }, [pointsData, draftManualPoints]); // ★ draftManualPoints を依存配列に追加 ★

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
    if (index > 900) {
        maxPenalty = 0.05;        // 最大5%失速
    } else if (index > 800) {
        maxPenalty = 0.10;        // 最大10%失速
    } else if (index > 700) {
        maxPenalty = 0.15;        // 最大15%失速
    } else if (index > 500) {
        maxPenalty = 0.40;        // 最大40%失速
    } else if (index > 450) {
        maxPenalty = 0.45;        // 最大45%失速
    } else if (index > 400) {
        maxPenalty = 0.50;        // 最大50%失速
    } else if (index > 350) {
        maxPenalty = 0.55;        // 最大55%失速
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
// ★ シミュレーション開始前に適用処理を実行 ★
        const pointsWithManual = applyManualPointsToPointsData(updatedPointsDataMemo, draftManualPoints);
        setPointsData(pointsWithManual);
        setManualPoints(draftManualPoints.map(p => ({ ...p }))); // manualPoints も更新
        setAppliedManualPoints(draftManualPoints.map(p => ({ ...p }))); // appliedManualPoints も更新
        setManualPointsApplied(true);
        setIsApplyButtonFlashing(false); // 適用ボタンのフリッカーを停止

        //if (!manualPointsApplied) {
        //  alert("入力情報を適用してからシミュレーションを実行してください。");
        //  return;
        //}
        // ★ シミュレーション前に手動ポイントを適用 ★
        //        const pointsWithManual = applyManualPointsToPointsData(updatedPointsDataMemo, draftManualPoints);
        //        setPointsData(pointsWithManual);

        if (!startTime || !calculatedAveragePace  || pointsData.length === 0) {
            alert("START時間、平均ペース、GPXデータが入力されていません。");
            return;
        }

        const [startHours, startMinutes] = startTime.split(':').map(Number);
        if (isNaN(startHours) || isNaN(startMinutes) || startHours < 0 || startHours > 23 || startMinutes < 0 || startMinutes > 59) {
            alert("START時間の形式が正しくありません (HH:MM)。");
            return;
        }

        const [paceMinutes, paceSeconds] = calculatedAveragePace.split(':').map(Number);
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
                } else if (gradient <= 30) {
                    gradientBasedPenaltyPercentage = 3.00; // 200%遅くする
                } else {
                    gradientBasedPenaltyPercentage = 4.00; // 400%遅くする
                }
            } else if (gradient < -5) { // 下り坂
                if (gradient <= -25) {
                    gradientBasedPenaltyPercentage = 0.50; // 50%遅くする
                } else if (gradient <= -20) {
                    gradientBasedPenaltyPercentage = 0.25; // 25%遅くする   
                } else if (gradient <= -10) {
                    gradientBasedPenaltyPercentage = 0.05; // 5%遅くする
                } else { // (gradient > -10 && gradient <= -5)
                    gradientBasedPenaltyPercentage = -0.20; // 20%速くする
                }
            } else { // 緩やかな勾配または平坦
                gradientBasedPenaltyPercentage = 0;
            }
            currentPaceInSecondsPerKm *= (1 + gradientBasedPenaltyPercentage); // パーセンテージを適用


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

//console.log(`Index: ${i}, 距離: ${currentPoint.cumulative_distance.toFixed(3)}, (${(cumulativeDistance - previousCumulativeDistance).toFixed(3)}), 標高: ${Math.round(currentPoint.elevation)}, 勾配: ${gradient.toFixed(3)}`);


            let gateTimeForTable = currentPoint.gateTime; // 初期値は手動設定された関門時間
            if (currentPoint.区分 === 'FINISH' && finishTime && finishTime !== '') {
                gateTimeForTable = finishTime; // FINISH地点の場合、入力されたfinishTimeを設定
            }

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
                gateTime: gateTimeForTable, // ★ ここで gateTime を追加 ★
                //gateTime: currentPoint.gateTime, // ★ ここで gateTime を追加 ★
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
                関門時間: gateTimeForTable, // ★ ここで gateTime を追加 ★
                //関門時間: currentPoint.gateTime, // ★ ここで gateTime を追加 ★
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
//        setManualPointsApplied(false); // ★ シミュレーション後にフラグをリセット ★
    }, [startTime, calculatedAveragePace, updatedPointsDataMemo, manualPoints, setCumulativeDistancesForGraph, setSimulationResult,
        setTableData, applyManualPointsToPointsData, pointsData, itraIndex, calculatePaceWithITRA, setIsApplyButtonFlashing ]);

    const pointsDataMemo = useMemo(() => pointsData, [pointsData]);
    const simulationResultMemo = useMemo(() => simulationResult, [simulationResult]);
    const cumulativeDistancesForGraphMemo = useMemo(() => cumulativeDistancesForGraph, [cumulativeDistancesForGraph]);

    return (
        <div className="App">
            <header className="App-header">
                <h1>
                    トレイルランニングシミュレータ <span className="app-version">R{APP_VERSION}</span>
                </h1>
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
                                    style={{ width: '60px' }}
                                    tabIndex={index + 1} // ★ 距離の tabindex ★
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>区分:</label>
                                <input
                                    type="text"
                                    value={point.type}
                                    onChange={(e) => handleDraftManualPointChange(index, 'type', e.target.value)}
                                    style={{ width: '100px' }}
                                    tabIndex={(draftManualPoints.length * 1) + index + 1} // ★ 区分 の tabindex ★
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>区分名:</label>
                                <input
                                    type="text"
                                    value={point.name}
                                    onChange={(e) => handleDraftManualPointChange(index, 'name', e.target.value)}
                                    style={{ width: '150px' }}
                                    tabIndex={(draftManualPoints.length * 2) + index + 1} // ★ 区分名 の tabindex ★
                                />
                            </div>
                            {/* ★ 休憩時間入力欄 ★ */}
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>休憩 (分):</label>
                                <input
                                    type="number"
                                    value={point.restTime}
                                    onChange={(e) => handleDraftManualPointChange(index, 'restTime', e.target.value)}
                                    style={{ width: '50px' }}
                                    tabIndex={(draftManualPoints.length * 3) + index + 1} // ★ 休憩時間 の tabindex ★
                                />
                            </div>
                            {/* ★ 関門時間入力欄 ★ */}
                            <div style={{ display: 'flex', alignItems: 'center', marginRight: '10px' }}>
                                <label style={{ marginRight: '5px' }}>関門時間:</label>
                                <input
                                    type="time" // または type="text"
                                    value={point.gateTime}
                                    onChange={(e) => handleDraftManualPointChange(index, 'gateTime', e.target.value)}
                                    style={{ width: '90px' }}
                                    tabIndex={(draftManualPoints.length * 4) + index + 1} // 必要に応じて調整
                                />
                            </div>
                            {draftManualPoints.length > 1 && (
                                <button type="button" onClick={() => removeManualPoint(point.id)} style={{ marginLeft: '5px' }}>削除</button>
                            )}
                        </div>
                    ))}
                    <button type="button" onClick={handleApplyManualPoints} disabled={!gpxFileLoaded}>エイド情報を保存</button>
                    {!gpxFileLoaded && <p className="warning-message">GPXファイルを読み込んでから適用してください。</p>}
                </div>
                <PaceInput
                    startTime={startTime}
                    finishTime={finishTime} // ★ 追加: finishTime を PaceInput に渡す ★
                    onStartTimeChange={handleStartTimeChange}
                    onFinishTimeChange={handleFinishTimeChange} // ★ 追加: onFinishTimeChange を PaceInput に渡す ★
                    onSimulate={handleSimulate}
                    itraIndex={itraIndex} // ★ ITRA Index を PaceInput に渡す
                    onItraIndexChange={handleItraIndexChange} // ★ ITRA Index の変更ハンドラを渡す
                    onFlatPaceInputChange={handleFlatPaceInputChange}
                    flatPaceInput={flatPaceInput}
                    calculatePaceFromFinishTime={calculatePaceFromFinishTime}
                    calculatedAveragePace={calculatedAveragePace} // ★ 追加 ★
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
                        <ResultTable
                            data={tableData}
                        />
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
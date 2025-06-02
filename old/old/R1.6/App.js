import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import PointInfo from './components/PointInfo';
import GPSImport from './components/GPSImport';
import PaceInput from './components/PaceInput';
import TimeGraph from './components/TimeGraph';
import ResultTable from './components/ResultTable';
import { parseString } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import isEqual from 'lodash/isEqual';
import './App.css';
import { PuffLoader } from 'react-spinners';

const toRadians = Math.PI / 180;
const R = 6371e3; // 地球の半径 (メートル)

function App() {
  const [pointsData, setPointsData] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [averagePace, setAveragePace] = useState('');
  const [itraIndex, setItraIndex] = useState(''); // ★ ITRAパフォーマンスインデックスの state
  const [simulationResult, setSimulationResult] = useState([]);
  const [cumulativeDistancesForGraph, setCumulativeDistancesForGraph] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [manualPoints, setManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '' }]);
  const [draftManualPoints, setDraftManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '' }]);
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
    setGpxFileLoaded(false);
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

  const generateStorageKey = useCallback((fileName) => {
    if (!fileName) return null;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    return `${baseName}_manual_points`;
  }, []);

  const loadManualPoints = useCallback((fileName) => {
    const key = generateStorageKey(fileName);
    if (key) {
      const storedPoints = localStorage.getItem(key);
      if (storedPoints) {
        try {
          const parsedPoints = JSON.parse(storedPoints);
          setManualPoints(parsedPoints);
          setDraftManualPoints(parsedPoints.map(p => ({ ...p })));
          setAppliedManualPoints(parsedPoints.map(p => ({ ...p }))); // ★ 初期ロード時にも appliedManualPoints を設定 ★
        } catch (error) {
          console.error("手動地点情報の読み込みエラー:", error);
        }
      }
    }
  }, [generateStorageKey, setManualPoints, setDraftManualPoints, setAppliedManualPoints]);

  const saveManualPoints = useCallback((fileName, currentManualPoints) => {
    const key = generateStorageKey(fileName);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(currentManualPoints));
        console.log(`手動地点情報を保存しました: ${key}`);
        setFeedbackMessage('地点情報を保存しました');
        setTimeout(() => setFeedbackMessage(''), 3000);
      } catch (error) {
        console.error("手動地点情報の保存エラー:", error);
        setFeedbackMessage('保存に失敗しました');
        setTimeout(() => setFeedbackMessage(''), 3000);
      }
    }
  }, [generateStorageKey, setFeedbackMessage]);

  // GPX読み込みハンドラ
  const handleGPSDataImport = useCallback((gpxData, fileName) => {
    console.log("handleGPSDataImport - gpxData:", gpxData ? gpxData.substring(0, 100) + '...' : null);
    console.log("handleGPSDataImport - fileName:", fileName);
    setGpxFileName(fileName);
    setGpxFileLoaded(true);
    setIsGPXLoading(true); // GPXデータ処理開始時にローディング開始
    loadManualPoints(fileName);

    if (gpxData) {
      parseString(gpxData, { explicitChildren: false }, (err, result) => {
        if (err) {
          console.error("GPXファイルの解析エラー:", err);
          alert("GPXファイルの解析に失敗しました。");
          setIsGPXLoading(false); // エラー時にもローディング終了
          return;
        }

        const trackPoints = result?.gpx?.trk?.[0]?.trkseg?.[0]?.trkpt || [];
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
          const latitude = parseFloat(trkpt.$.lat);
          const longitude = parseFloat(trkpt.$.lon);
          const elevation = trkpt.ele ? parseInt(trkpt.ele[0]) : null;
          const time = trkpt.time ? trkpt.time[0] : null;
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
        setIsGPXLoading(false); // GPXデータの処理が完了したら、ローディングを終了させる
      });
    } else {
      console.log("GPXデータのインポートがキャンセルされました。");
      setGpxFileLoaded(false);
      setIsGPXLoading(false); // キャンセル時もローディング終了
    }
  }, [calculateDistance, setPointsData, loadManualPoints, setGpxFileName, setGpxFileLoaded]);


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
    setDraftManualPoints(prevPoints => [...prevPoints, { id: uuidv4(), distance: '', type: '', name: '' }]);
  }, []);

  const removeManualPoint = useCallback((id) => {
    setDraftManualPoints(prevPoints => prevPoints.filter(point => point.id !== id));
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
    saveManualPoints(gpxFileName, draftManualPoints);
    setManualPoints(draftManualPoints.map(p => ({ ...p })));
    setAppliedManualPoints(draftManualPoints.map(p => ({ ...p }))); // ★ appliedManualPoints を更新 ★
    setManualPointsApplied(true);

    // ★ ここで pointsData を更新して手動地点の情報を反映させる ★
    setPointsData(prevPointsData => applyManualPointsToPointsData(prevPointsData, draftManualPoints));

  }, [gpxFileName, draftManualPoints, saveManualPoints, applyManualPointsToPointsData]);

  const updatedPointsDataMemo = useMemo(() => {
    return pointsData.map(point => ({ ...point }));
  }, [pointsData]);

  useEffect(() => {
    if (!manualPointsApplied && pointsData.length > 0) {
      const initialPointsData = pointsData.map(point => ({ ...point }));
      if (initialPointsData.length > 0) {
        initialPointsData[0].区分 = 'START';
        if (initialPointsData.length > 1) {
          initialPointsData[initialPointsData.length - 1].区分 = 'FINISH';
        }
      }
      if (!isEqual(previousPointsDataRef.current, initialPointsData)) {
        setPointsData(initialPointsData);
        previousPointsDataRef.current = initialPointsData;
      }
    } else if (pointsData.length === 0 && previousPointsDataRef.current?.length > 0) {
      setPointsData([]);
      previousPointsDataRef.current = null;
    }
    setManualPointsApplied(false); // ★ useEffect の最後で false に戻す ★
  }, [isEqual, pointsData]);

  // ITRA Performance Indexによるペース補正関数
  const calculatePaceWithITRA = useCallback((basePaceInSecondsPerKm, itraIndexValue, distanceRatio) => {
    let modifiedPace = basePaceInSecondsPerKm;
    const index = itraIndexValue;

    // ITRA Indexに応じた最大失速率設定
    let maxPenalty;
    if (index > 825) {
      maxPenalty = 0.05;    // 最大5%失速
    } else if (index > 725) {
      maxPenalty = 0.10;  // 最大10%失速
    } else if (index > 550) {
      maxPenalty = 0.15;  // 最大15%失速
    } else if (index > 350) {
      maxPenalty = 0.40;  // 最大40%失速
    } else {
      maxPenalty = 0.50;  // 最大50%失速
    }

    // レース後半（50%以上進行）でのみ失速を適用
    const lateStart = 0.5;
    if (!isNaN(index) && distanceRatio > lateStart) {
      const lateFactor = (distanceRatio - lateStart) / (1 - lateStart); // 0〜1
      const latePenalty = maxPenalty * lateFactor;
      modifiedPace *= (1 + latePenalty);
    }

    return modifiedPace;
  }, []);

  const handleSimulate = useCallback(() => {
    const pointsWithManual = applyManualPointsToPointsData(updatedPointsDataMemo, manualPoints);
    setPointsData(pointsWithManual);

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

    let currentTime = new Date(start);
    const newResults = [];
    const newCumulativeDistances = [];
    const newTableData = [];
    let reachedFirstKm = false;
    let firstKmArrivalTimeTemp = null;

    let maxDistanceRatio = 0; // ★ ここで maxDistanceRatio を宣言 ★

    for (let i = 0; i < pointsData.length; i++) {
      const currentPoint = pointsData[i];
      const distanceRatio = totalDistance > 0 ? currentPoint.cumulative_distance / totalDistance : 0;
      let currentPaceInSecondsPerKm = calculatePaceWithITRA(basePaceInSecondsPerKm, itraIndexValue, distanceRatio);

      // ★ 既存の勾配によるペース補正を適用 ★
      const uphillPacePenaltyPerPercent = 2;
      const downhillPaceBenefitPerPercent = 1;
      const gradient = currentPoint.section_gradient || 0;

      if (gradient > 0) {
        currentPaceInSecondsPerKm += gradient * uphillPacePenaltyPerPercent;
      } else if (gradient < 0) {
        currentPaceInSecondsPerKm -= Math.abs(gradient) * downhillPaceBenefitPerPercent;
      }

      const travelTimeInSeconds = currentPoint.section_distance * currentPaceInSecondsPerKm;

      if (i === 0) {
        currentTime = new Date(start);
      } else {
        currentTime = new Date(currentTime.getTime() + travelTimeInSeconds * 1000);
      }

      const arrivalTimeFormatted = currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const cumulativeDistance = currentPoint.cumulative_distance;
      const elevation = parseInt(currentPoint.elevation);
      const previousCumulativeDistance = i > 0 ? pointsData[i - 1].cumulative_distance : 0;
      const sectionDistance = (cumulativeDistance - previousCumulativeDistance).toFixed(2);

      newResults.push({
        name: currentPoint.name,
        arrivalTime: arrivalTimeFormatted,
        cumulativeDistance: cumulativeDistance,
        elevation: elevation,
        section_gradient: gradient,
        区分: currentPoint.区分,
        区分名称: currentPoint.区分名称,
      });
      newCumulativeDistances.push(cumulativeDistance);
      newTableData.push({
        区分: currentPoint.区分,
        区分名称: currentPoint.区分名称,
        累積距離: cumulativeDistance.toFixed(1),
        区間距離: sectionDistance,
        標高: elevation,
        到着時刻: arrivalTimeFormatted,
      });

      if (!reachedFirstKm && cumulativeDistance >= 1) {
        firstKmArrivalTimeTemp = arrivalTimeFormatted;
        reachedFirstKm = true;
      }
      maxDistanceRatio = Math.max(maxDistanceRatio, distanceRatio); // ★ ここで計算 ★
    }

    setFirstKmArrivalTime(firstKmArrivalTimeTemp);
    setCumulativeDistancesForGraph(newCumulativeDistances);
    setSimulationResult(newResults);
    setTableData(newTableData);
  }, [startTime, averagePace, updatedPointsDataMemo, manualPoints, setCumulativeDistancesForGraph, setSimulationResult,
    setTableData, applyManualPointsToPointsData, pointsData, itraIndex, calculatePaceWithITRA]); // calculatePaceWithITRA を依存配列に追加

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
          <h2>地点情報手動入力</h2>
          {draftManualPoints.map((point, index) => (
            <div key={point.id}>
              <label>距離 (km):</label>
              <input
                type="number"
                value={point.distance}
                onChange={(e) => {
                  const newDraftPoints = [...draftManualPoints];
                  newDraftPoints[index].distance = e.target.value;
                  setDraftManualPoints(newDraftPoints);
                }}
              />
              <label>区分:</label>
              <input
                type="text"
                value={point.type}
                onChange={(e) => {
                  const newDraftPoints = [...draftManualPoints];
                  newDraftPoints[index].type = e.target.value;
                  setDraftManualPoints(newDraftPoints);
                }}
              />
              <label>区分名:</label>
              <input
                type="text"
                value={point.name}
                onChange={(e) => {
                  const newDraftPoints = [...draftManualPoints];
                  newDraftPoints[index].name = e.target.value;
                  setDraftManualPoints(newDraftPoints);
                }}
              />
              {draftManualPoints.length > 1 && (
                <button type="button" onClick={() => removeManualPoint(point.id)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={handleApplyManualPoints} disabled={!gpxFileLoaded}>適用</button>
          {!gpxFileLoaded && <p className="warning-message">GPXファイルを読み込んでから適用してください。</p>}
          <button type="button" onClick={addManualPoint}>地点を追加</button>
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
            />
            <ResultTable data={tableData} />
          </>
        )}
        {pointsData.map((point, index) => (
          <PointInfo key={point.id} point={point} />
        ))}
      </main>
    </div>
  );
}

export default App;

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PointInfo from './components/PointInfo';
import GPSImport from './components/GPSImport';
import PaceInput from './components/PaceInput';
import TimeGraph from './components/TimeGraph';
import ResultTable from './components/ResultTable';
import { parseString } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import isEqual from 'lodash/isEqual';
import './App.css';

const toRadians = Math.PI / 180;
const R = 6371e3; // 地球の半径 (メートル)

function App() {
  const [pointsData, setPointsData] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [averagePace, setAveragePace] = useState('');
  const [simulationResult, setSimulationResult] = useState([]);
  const [cumulativeDistancesForGraph, setCumulativeDistancesForGraph] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [manualPoints, setManualPoints] = useState([{ id: uuidv4(), distance: '', type: '', name: '' }]);
  const previousPointsDataRef = useRef(null);
  const [manualPointsApplied, setManualPointsApplied] = useState(false); // ★ 新しい state ★
  const [firstKmArrivalTime, setFirstKmArrivalTime] = useState(null); // ★ 1km地点の到着時刻 state ★

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

  const handleGPSDataImport = useCallback((gpxData) => {
    if (gpxData) {
      parseString(gpxData, { explicitChildren: false }, (err, result) => {
        if (err) {
          console.error("GPXファイルの解析エラー:", err);
          alert("GPXファイルの解析に失敗しました。");
          return;
        }

        const trackPoints = result?.gpx?.trk?.[0]?.trkseg?.[0]?.trkpt || [];
        if (trackPoints.length === 0) {
          alert("GPXファイルにトラックポイントが含まれていません。");
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
      });
    } else {
      console.log("GPXデータのインポートがキャンセルされました。");
    }
  }, [calculateDistance, setPointsData]);

  const handleStartTimeChange = useCallback((event) => {
    setStartTime(event.target.value);
  }, []);

  const handleAveragePaceChange = useCallback((event) => {
    setAveragePace(event.target.value);
  }, []);

  const handleManualPointChange = useCallback((id, field, value) => {
    console.log(`handleManualPointChange - ID: ${id}, Field: ${field}, Value: ${value}`);
    setManualPoints(prevPoints => {
      console.log('handleManualPointChange - Previous manualPoints:', prevPoints);
      const updatedPoints = prevPoints.map(point => {
        if (point.id === id) {
          return { ...point, [field]: value };
        }
        return point;
      });
      console.log('handleManualPointChange - Updated manualPoints:');
      updatedPoints.forEach(p => console.log(`  ID: ${p.id}, Distance: ${p.distance}`));
      return updatedPoints;
    });
  }, []);

  const addManualPoint = useCallback(() => {
    setManualPoints(prevPoints => [...prevPoints, { id: uuidv4(), distance: '', type: '', name: '' }]);
  }, []);

  const removeManualPoint = useCallback((id) => {
    setManualPoints(prevPoints => prevPoints.filter(point => point.id !== id));
  }, []);

  const updatedPointsDataMemo = useMemo(() => {
    if (pointsData.length > 0) {
      return pointsData.map(point => ({ ...point }));
    }
    return [];
  }, [pointsData]);

  useEffect(() => {
    if (manualPointsApplied && updatedPointsDataMemo.length > 0) {
      const newPointsData = updatedPointsDataMemo.map(point => ({ ...point }));
      manualPoints.forEach(manualPoint => {
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

      // START/FINISH を手動設定が上書きしないように
      if (newPointsData.length > 0) {
        newPointsData[0].区分 = 'START';
        if (newPointsData.length > 1) {
          newPointsData[newPointsData.length - 1].区分 = 'FINISH';
        }
      }

      if (!isEqual(previousPointsDataRef.current, newPointsData)) {
        setPointsData(newPointsData);
        previousPointsDataRef.current = newPointsData;
      }
      setManualPointsApplied(false);
    } else if (!manualPointsApplied && pointsData.length > 0) {
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
    } else {
      setPointsData([]);
      previousPointsDataRef.current = [];
    }
  }, [updatedPointsDataMemo, manualPoints, manualPointsApplied, isEqual, pointsData.length]);

  const handleSimulate = useCallback(() => {
    // シミュレーション実行前に manualPoints を pointsData に反映させる
    const pointsWithManual = updatedPointsDataMemo.map(point => ({ ...point }));
    manualPoints.forEach(manualPoint => {
      const distance = parseFloat(manualPoint.distance);
      if (!isNaN(distance)) {
        let closestIndex = -1;
        let minDifference = Infinity;

        pointsWithManual.forEach((point, index) => {
          const difference = Math.abs(point.cumulative_distance - distance);
          if (difference < minDifference) {
            minDifference = difference;
            closestIndex = index;
          } else if (difference === minDifference && point.cumulative_distance > distance) {
            closestIndex = index;
          }
        });

        if (closestIndex !== -1) {
          pointsWithManual[closestIndex].区分 = manualPoint.type;
          pointsWithManual[closestIndex].区分名称 = manualPoint.name;
          pointsWithManual[closestIndex].manual = true;
        }
      }
    });

    // START/FINISH を手動設定が上書きしないように
    if (pointsWithManual.length > 0) {
      pointsWithManual[0].区分 = 'START';
      if (pointsWithManual.length > 1) {
        pointsWithManual[pointsWithManual.length - 1].区分 = 'FINISH';
      }
    }
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
    const paceInSecondsPerKm = paceMinutes * 60 + paceSeconds;

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

    for (let i = 0; i < pointsData.length; i++) {
      const currentPoint = pointsData[i];
      const travelTimeInSeconds = currentPoint.section_distance * paceInSecondsPerKm;

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
        section_gradient: currentPoint.section_gradient,
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
    }

    setFirstKmArrivalTime(firstKmArrivalTimeTemp);
    setCumulativeDistancesForGraph(newCumulativeDistances);
    setSimulationResult(newResults);
    setTableData(newTableData);
  }, [startTime, averagePace, updatedPointsDataMemo, manualPoints, setCumulativeDistancesForGraph, setSimulationResult, setTableData]);

  const pointsDataMemo = useMemo(() => pointsData, [pointsData]);
  const simulationResultMemo = useMemo(() => simulationResult, [simulationResult]);
  const cumulativeDistancesForGraphMemo = useMemo(() => cumulativeDistancesForGraph, [cumulativeDistancesForGraph]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>トレイルランニングシミュレータ</h1>
      </header>
      <main>
        <GPSImport onDataImport={handleGPSDataImport} />
        <div>
          <h2>地点情報手動入力</h2>
          {manualPoints.map((point, index) => (
            <div key={point.id}>
              <label>距離 (km):</label>
              <input
                type="number"
                value={point.distance}
                data-id={point.id}
                onChange={(e) => {
                  const id = e.target.dataset.id;
                  handleManualPointChange(id, 'distance', e.target.value);
                }}
              />
              <label>区分:</label>
              <input
                type="text"
                value={point.type}
                data-id={point.id}
                onChange={(e) => {
                  const id = e.target.dataset.id;
                  handleManualPointChange(id, 'type', e.target.value);
                }}
              />
              <label>区分名:</label>
              <input
                type="text"
                value={point.name}
                data-id={point.id}
                onChange={(e) => {
                  const id = e.target.dataset.id;
                  handleManualPointChange(id, 'name', e.target.value);
                }}
              />
              {manualPoints.length > 1 && (
                <button type="button" onClick={() => removeManualPoint(point.id)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setManualPointsApplied(true)}>適用</button> {/* ★ 適用ボタン ★ */}
          <button type="button" onClick={addManualPoint}>地点を追加</button>
        </div>
        <PaceInput
          startTime={startTime}
          averagePace={averagePace}
          onStartTimeChange={handleStartTimeChange}
          onAveragePaceChange={handleAveragePaceChange}
          onSimulate={handleSimulate}
        />
        {firstKmArrivalTime && (
          <p>累積 1km 地点の到着時刻: {firstKmArrivalTime}</p>
        )}
        {simulationResult.length > 0 && (
          <>
            <TimeGraph
              results={simulationResultMemo}
              startTime={startTime}
              interval={10}
              cumulativeDistances={cumulativeDistancesForGraphMemo}
              pointsData={pointsDataMemo}
              manualPoints={manualPoints} // ★ ここに追加 ★
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
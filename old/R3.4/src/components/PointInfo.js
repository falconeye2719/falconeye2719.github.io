import React from 'react';

function PointInfo(props) {
  const { point } = props;

  return (
    <div style={pointInfoStyle}>
      <h3>{point.name}</h3>
      <p>区分: {point.point_type}</p>
      <p>累積距離: {point.cumulative_distance} km</p>
      <p>区間距離: {point.section_distance} km</p>
      <p>標高: {point.elevation} m</p>
      <p>区間勾配: {(point.section_gradient * 100).toFixed(2)} %</p>
      <p>路面: {point.surface_type}</p>
      {point.arrival_time && <p>到着時刻: {point.arrival_time}</p>}
      {point.rest_time !== undefined && <p>休憩時間: {point.rest_time} 分</p>}
    </div>
  );
}

const pointInfoStyle = {
  border: '1px solid #ccc',
  padding: '10px',
  margin: '10px',
  borderRadius: '5px',
};

export default PointInfo;

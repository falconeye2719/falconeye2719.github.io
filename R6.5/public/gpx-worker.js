// public/gpx-worker.js

// fast-xml-parser は Worker スコープでインポートする必要があります
import { XMLParser } from './fast-xml-parser.min.js'; // または node_modules からのパス

onmessage = (event) => {
    const fileData = event.data;

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (tagName, jPath, isLeaf, isAttribute) => {
            if (tagName === 'trkpt') return true;
            return false;
        }
        // 必要に応じて他のオプションも設定
    });

    try {
        const result = parser.parse(fileData);
        const trackPoints = result?.gpx?.trk?.[0]?.trkseg?.[0]?.trkpt || [];
        const newPointsData = [];
        let cumulativeDistance = 0;
        let previousPoint = null;

        for (let i = 0; i < trackPoints.length; i++) {
            const trkpt = trackPoints[i];
            const latitude = parseFloat(trkpt["@_lat"]);
            const longitude = parseFloat(trkpt["@_lon"]);
            const elevation = parseInt(trkpt?.ele);
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

        postMessage(newPointsData); // 解析・データ処理後の結果をメインスレッドに送信

    } catch (error) {
        postMessage({ error: error.message });
    }
};

// Worker スコープで calculateDistance 関数を定義する必要があります
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球の半径 (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // 距離 (km)
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
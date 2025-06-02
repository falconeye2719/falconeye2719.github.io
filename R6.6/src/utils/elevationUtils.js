//近隣の標高データの平均を計算し、誤差を軽減
//windowSize を調整すると、スムージングの強度を変えられる
// const smoothedElevations = smoothElevation(elevationArray, 3); // 細かい変化
// const smoothedElevations = smoothElevation(elevationArray, 10); // より滑らかに

export const smoothElevation = (elevationArray, windowSize = 5) => {
    return elevationArray.map((_, index, array) => {
        const start = Math.max(index - Math.floor(windowSize / 2), 0);
        const end = Math.min(index + Math.floor(windowSize / 2), array.length - 1);
        const subset = array.slice(start, end + 1);
        return subset.reduce((sum, val) => sum + val, 0) / subset.length;
    });
};
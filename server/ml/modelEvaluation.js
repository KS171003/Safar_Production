const MAX_HISTORY = 1000;
let history = []; // ring buffer

function recordPrediction(predictedMinutes, actualMinutes) {
  if (predictedMinutes == null || actualMinutes == null) return;
  
  if (history.length >= MAX_HISTORY) {
    history.shift(); // remove oldest
  }
  
  history.push({
    predicted: predictedMinutes,
    actual: actualMinutes,
    timestamp: Date.now()
  });
}

function getAccuracyMetrics() {
  if (history.length === 0) {
    return { mae: 0, rmse: 0, r2: 0, sampleCount: 0 };
  }
  
  let mae = 0, mse = 0, ssTot = 0, ssRes = 0;
  let actualMean = history.reduce((sum, h) => sum + h.actual, 0) / history.length;
  
  for (const h of history) {
    mae += Math.abs(h.actual - h.predicted);
    mse += Math.pow(h.actual - h.predicted, 2);
    ssTot += Math.pow(h.actual - actualMean, 2);
    ssRes += Math.pow(h.actual - h.predicted, 2);
  }
  
  mae /= history.length;
  mse /= history.length;
  const rmse = Math.sqrt(mse);
  const r2 = ssTot === 0 ? 0 : (1 - (ssRes / ssTot));
  
  return {
    mae,
    rmse,
    r2,
    sampleCount: history.length
  };
}

function getPredictionHistory(limit = 100) {
  return history.slice(-limit);
}

module.exports = {
  recordPrediction,
  getAccuracyMetrics,
  getPredictionHistory
};

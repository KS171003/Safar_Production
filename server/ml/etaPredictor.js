const util = require('util');
util.isNullOrUndefined = util.isNullOrUndefined || ((val) => val === undefined || val === null);
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const { extractFeatures } = require('./featureEngineering');

let model = null;
let normParams = null;
let metrics = null;
let isLoaded = false;
let loadError = false;

async function loadModel() {
  if (isLoaded) return true;
  if (loadError) return false;
  
  try {
    const modelPath = `file://${path.join(__dirname, 'saved_model', 'model.json')}`;
    model = await tf.loadLayersModel(modelPath);
    
    const normPath = path.join(__dirname, 'normalization_params.json');
    normParams = JSON.parse(fs.readFileSync(normPath, 'utf-8'));
    
    const metricsPath = path.join(__dirname, 'training_metrics.json');
    if (fs.existsSync(metricsPath)) {
      metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    } else {
      metrics = { mae: 2.5, rmse: 3.5, r2: 0.8 }; // reasonable fallback
    }
    
    isLoaded = true;
    return true;
  } catch (err) {
    console.error('Failed to load ML model:', err.message);
    loadError = true;
    return false;
  }
}

async function isModelReady() {
  return await loadModel();
}

function getModelInfo() {
  if (!isLoaded) return { status: 'not_loaded' };
  return {
    status: 'loaded',
    version: '1.0',
    metrics
  };
}

async function predictETA(bus, route, destinationStopIndex, trackingHistory = []) {
  const ready = await loadModel();
  if (!ready) return null;
  
  try {
    const features = extractFeatures(bus, route, destinationStopIndex, trackingHistory);
    
    // Normalize
    const normalizedFeatures = features.map((f, i) => {
      const range = normParams.maxVals[i] - normParams.minVals[i];
      return range === 0 ? 0 : (f - normParams.minVals[i]) / range;
    });
    
    // Predict
    const input = tf.tensor2d([normalizedFeatures]);
    const output = model.predict(input);
    let etaMinutes = output.arraySync()[0][0];
    
    if (etaMinutes < 0) etaMinutes = 0; // cant be negative
    
    const margin = metrics.mae * 1.5;
    
    return {
      etaMinutes,
      confidenceInterval: {
        lower: Math.max(0, etaMinutes - margin),
        upper: etaMinutes + margin
      },
      method: 'ml'
    };
  } catch (err) {
    console.error('Error during ML prediction:', err.message);
    return null;
  }
}

module.exports = {
  predictETA,
  isModelReady,
  getModelInfo
};

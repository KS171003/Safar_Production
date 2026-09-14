const util = require('util');
util.isNullOrUndefined = util.isNullOrUndefined || ((val) => val === undefined || val === null);
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const { FEATURE_COUNT } = require('./featureEngineering');
const { generateSyntheticData } = require('./syntheticDataGenerator');

/**
 * Calculates statistical regression metrics.
 */
function evaluateMetrics(yTrue, yPred) {
  let mae = 0;
  let mse = 0;
  const errors = [];

  const yMean = yTrue.reduce((a, b) => a + b, 0) / yTrue.length;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const err = Math.abs(yTrue[i] - yPred[i]);
    errors.push(err);
    mae += err;
    mse += Math.pow(yTrue[i] - yPred[i], 2);
    ssTot += Math.pow(yTrue[i] - yMean, 2);
    ssRes += Math.pow(yTrue[i] - yPred[i], 2);
  }

  mae /= yTrue.length;
  mse /= yTrue.length;
  const rmse = Math.sqrt(mse);
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  // Median and P90 error
  errors.sort((a, b) => a - b);
  const median = errors[Math.floor(errors.length * 0.5)];
  const p90 = errors[Math.floor(errors.length * 0.9)];

  return {
    mae: Number(mae.toFixed(4)),
    rmse: Number(rmse.toFixed(4)),
    r2: Number(r2.toFixed(4)),
    medianError: Number(median.toFixed(4)),
    p90Error: Number(p90.toFixed(4)),
    sampleCount: yTrue.length,
  };
}

async function train() {
  console.log('=== SAFAR Production Hybrid ML ETA Training Pipeline ===');
  const dataPath = path.join(__dirname, 'training_data.json');
  let data;
  if (fs.existsSync(dataPath)) {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } else {
    data = generateSyntheticData();
  }

  // -------------------------------------------------------------
  // PHASE 15: Trip-Based Chronological Split (Zero Data Leakage)
  // -------------------------------------------------------------
  const uniqueTripIds = [...new Set(data.map((d) => d.tripId))];
  const trainTripCount = Math.floor(uniqueTripIds.length * 0.70);
  const valTripCount = Math.floor(uniqueTripIds.length * 0.15);

  const trainTripSet = new Set(uniqueTripIds.slice(0, trainTripCount));
  const valTripSet = new Set(uniqueTripIds.slice(trainTripCount, trainTripCount + valTripCount));
  const testTripSet = new Set(uniqueTripIds.slice(trainTripCount + valTripCount));

  const trainData = data.filter((d) => trainTripSet.has(d.tripId));
  const valData = data.filter((d) => valTripSet.has(d.tripId));
  const testData = data.filter((d) => testTripSet.has(d.tripId));

  console.log(`Dataset Split (by whole trips):`);
  console.log(`- Train Trips: ${trainTripSet.size} (${trainData.length} samples)`);
  console.log(`- Validation Trips: ${valTripSet.size} (${valData.length} samples)`);
  console.log(`- Held-out Test Trips: ${testTripSet.size} (${testData.length} samples)`);

  // -------------------------------------------------------------
  // PHASE 16: Normalization Fitted STRICTLY on Train Set
  // -------------------------------------------------------------
  const minVals = new Array(FEATURE_COUNT).fill(Infinity);
  const maxVals = new Array(FEATURE_COUNT).fill(-Infinity);

  trainData.forEach((d) => {
    d.features.forEach((f, i) => {
      if (f < minVals[i]) minVals[i] = f;
      if (f > maxVals[i]) maxVals[i] = f;
    });
  });

  const trainResiduals = trainData.map((d) => d.residual);
  const resMean = trainResiduals.reduce((a, b) => a + b, 0) / trainResiduals.length;
  const resStd = Math.sqrt(trainResiduals.reduce((a, b) => a + Math.pow(b - resMean, 2), 0) / trainResiduals.length) || 1;

  const normParams = { minVals, maxVals, resMean, resStd, fittedOnSamples: trainData.length };
  fs.writeFileSync(
    path.join(__dirname, 'normalization_params.json'),
    JSON.stringify(normParams, null, 2)
  );

  const scale = (featureArray) => {
    return featureArray.map((f, i) => {
      const range = maxVals[i] - minVals[i];
      if (range === 0) return 0;
      return Math.max(0, Math.min(1, (f - minVals[i]) / range));
    });
  };

  const trainX = tf.tensor2d(trainData.map((d) => scale(d.features)));
  const trainY = tf.tensor2d(trainData.map((d) => (d.residual - resMean) / resStd), [trainData.length, 1]);

  const valX = tf.tensor2d(valData.map((d) => scale(d.features)));
  const valY = tf.tensor2d(valData.map((d) => (d.residual - resMean) / resStd), [valData.length, 1]);

  const testX = tf.tensor2d(testData.map((d) => scale(d.features)));

  // -------------------------------------------------------------
  // Model Architecture: Deep Residual Neural Network
  // -------------------------------------------------------------
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [FEATURE_COUNT] }));
  model.add(tf.layers.dropout({ rate: 0.15 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'linear' })); // Predicts standardized traffic residual

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  console.log('\nTraining Neural Residual Predictor for 50 epochs...');
  await model.fit(trainX, trainY, {
    epochs: 50,
    batchSize: 32,
    validationData: [valX, valY],
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(`Epoch ${epoch + 1}/50 - Loss: ${logs.loss.toFixed(4)} - Val Loss: ${logs.val_loss.toFixed(4)}`);
        }
      },
    },
  });

  // -------------------------------------------------------------
  // PHASE 21 & 22: Baselines Comparison on HELD-OUT TEST SET
  // -------------------------------------------------------------
  const testLabels = testData.map((d) => d.label);
  const testBaselines = testData.map((d) => d.baselineETA);

  // Baseline 1: Constant-speed kinematic baseline
  const kinematicBaselineMetrics = evaluateMetrics(testLabels, testBaselines);

  // Baseline 2: Historical average ETA
  const historicalAvg = trainData.reduce((acc, d) => acc + d.label, 0) / trainData.length;
  const historicalAvgPredictions = new Array(testLabels.length).fill(historicalAvg);
  const historicalAvgMetrics = evaluateMetrics(testLabels, historicalAvgPredictions);

  // Model Prediction on Held-Out Test Set (Unstandardized)
  const predictedResidualsNorm = model.predict(testX).arraySync().map((v) => v[0]);
  const predictedResiduals = predictedResidualsNorm.map((p) => p * resStd + resMean);
  const hybridPredictions = testData.map((d, i) => Math.max(0.5, d.baselineETA + predictedResiduals[i]));
  const hybridModelMetrics = evaluateMetrics(testLabels, hybridPredictions);

  console.log('\n=== Comprehensive Held-Out Test Set Evaluation (No Leakage) ===');
  console.log('1. Historical Average Baseline:  MAE =', historicalAvgMetrics.mae, 'min | RMSE =', historicalAvgMetrics.rmse, 'min');
  console.log('2. Constant Kinematic Baseline:  MAE =', kinematicBaselineMetrics.mae, 'min | RMSE =', kinematicBaselineMetrics.rmse, 'min');
  console.log('3. Hybrid Neural Residual Model: MAE =', hybridModelMetrics.mae, 'min | RMSE =', hybridModelMetrics.rmse, 'min | R² =', hybridModelMetrics.r2);
  console.log('   Median Absolute Error:        ', hybridModelMetrics.medianError, 'min');
  console.log('   P90 Absolute Error:           ', hybridModelMetrics.p90Error, 'min');

  // Segmented evaluations on held-out test data
  const rushHourTest = testData.filter((d) => d.isRushHour === 1);
  const offPeakTest = testData.filter((d) => d.isRushHour === 0);

  const rushIndices = testData.map((d, i) => (d.isRushHour === 1 ? i : -1)).filter((i) => i !== -1);
  const offPeakIndices = testData.map((d, i) => (d.isRushHour === 0 ? i : -1)).filter((i) => i !== -1);

  const rushMetrics = evaluateMetrics(
    rushIndices.map((i) => testLabels[i]),
    rushIndices.map((i) => hybridPredictions[i])
  );
  const offPeakMetrics = evaluateMetrics(
    offPeakIndices.map((i) => testLabels[i]),
    offPeakIndices.map((i) => hybridPredictions[i])
  );

  console.log(`\nSlices by Traffic Window:`);
  console.log(`- Rush Hour:  MAE = ${rushMetrics.mae} min | P90 = ${rushMetrics.p90Error} min (n=${rushIndices.length})`);
  console.log(`- Off-Peak:   MAE = ${offPeakMetrics.mae} min | P90 = ${offPeakMetrics.p90Error} min (n=${offPeakIndices.length})`);

  // -------------------------------------------------------------
  // PHASE 25: Model Metadata & Versioning
  // -------------------------------------------------------------
  const metadata = {
    modelVersion: 'eta-v2.0-hybrid',
    datasetType: 'synthetic',
    datasetVersion: 'synthetic-delhi-trips-v2',
    featureVersion: '2.0',
    featureCount: FEATURE_COUNT,
    trainingTimestamp: new Date().toISOString(),
    testMetrics: {
      hybridModel: hybridModelMetrics,
      kinematicBaseline: kinematicBaselineMetrics,
      historicalAverageBaseline: historicalAvgMetrics,
      slices: {
        rushHour: rushMetrics,
        offPeak: offPeakMetrics,
      },
    },
    datasetSplits: {
      trainTrips: trainTripSet.size,
      trainSamples: trainData.length,
      valTrips: valTripSet.size,
      valSamples: valData.length,
      testTrips: testTripSet.size,
      testSamples: testData.length,
    },
  };

  const savedModelDir = path.join(__dirname, 'saved_model');
  if (!fs.existsSync(savedModelDir)) {
    fs.mkdirSync(savedModelDir, { recursive: true });
  }

  fs.writeFileSync(path.join(savedModelDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(path.join(__dirname, 'training_metrics.json'), JSON.stringify(hybridModelMetrics, null, 2));

  await model.save(`file://${savedModelDir}`);
  console.log('Model and metadata saved successfully to server/ml/saved_model/');
}

if (require.main === module) {
  train().catch(console.error);
}

module.exports = { train };

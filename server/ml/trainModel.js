const util = require('util');
util.isNullOrUndefined = util.isNullOrUndefined || ((val) => val === undefined || val === null);
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const { FEATURE_COUNT } = require('./featureEngineering');
const { generateSyntheticData } = require('./syntheticDataGenerator');

async function train() {
  const dataPath = path.join(__dirname, 'training_data.json');
  let data;
  if (fs.existsSync(dataPath)) {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } else {
    data = generateSyntheticData();
  }

  // Shuffle data
  tf.util.shuffle(data);

  // Normalize features
  let minVals = new Array(FEATURE_COUNT).fill(Infinity);
  let maxVals = new Array(FEATURE_COUNT).fill(-Infinity);

  data.forEach(d => {
    d.features.forEach((f, i) => {
      if (f < minVals[i]) minVals[i] = f;
      if (f > maxVals[i]) maxVals[i] = f;
    });
  });

  const normParams = { minVals, maxVals };
  fs.writeFileSync(path.join(__dirname, 'normalization_params.json'), JSON.stringify(normParams, null, 2));

  const normalizedFeatures = data.map(d => 
    d.features.map((f, i) => {
      const range = maxVals[i] - minVals[i];
      return range === 0 ? 0 : (f - minVals[i]) / range;
    })
  );

  const labels = data.map(d => d.label);

  const splitIdx = Math.floor(data.length * 0.8);
  
  const trainX = tf.tensor2d(normalizedFeatures.slice(0, splitIdx));
  const trainY = tf.tensor2d(labels.slice(0, splitIdx), [splitIdx, 1]);
  
  const valX = tf.tensor2d(normalizedFeatures.slice(splitIdx));
  const valY = tf.tensor2d(labels.slice(splitIdx), [labels.length - splitIdx, 1]);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [FEATURE_COUNT] }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'linear' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
  });

  console.log('Starting training...');
  await model.fit(trainX, trainY, {
    epochs: 100,
    batchSize: 32,
    validationData: [valX, valY],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(`Epoch ${epoch + 1} - Loss: ${logs.loss.toFixed(4)} - Val Loss: ${logs.val_loss.toFixed(4)}`);
        }
      }
    }
  });

  // Evaluation
  const preds = model.predict(valX);
  const yTrue = valY.arraySync().map(v => v[0]);
  const yPred = preds.arraySync().map(v => v[0]);

  let mae = 0, mse = 0, ssTot = 0, ssRes = 0;
  let yMean = yTrue.reduce((a,b)=>a+b, 0) / yTrue.length;

  for (let i = 0; i < yTrue.length; i++) {
    mae += Math.abs(yTrue[i] - yPred[i]);
    mse += Math.pow(yTrue[i] - yPred[i], 2);
    ssTot += Math.pow(yTrue[i] - yMean, 2);
    ssRes += Math.pow(yTrue[i] - yPred[i], 2);
  }

  mae /= yTrue.length;
  mse /= yTrue.length;
  const rmse = Math.sqrt(mse);
  const r2 = 1 - (ssRes / ssTot);

  console.log('\\nValidation Metrics:');
  console.log(`MAE:  ${mae.toFixed(4)} minutes`);
  console.log(`RMSE: ${rmse.toFixed(4)} minutes`);
  console.log(`R²:   ${r2.toFixed(4)}`);

  const metrics = { mae, rmse, r2 };
  fs.writeFileSync(path.join(__dirname, 'training_metrics.json'), JSON.stringify(metrics, null, 2));

  await model.save(`file://${path.join(__dirname, 'saved_model')}`);
  console.log('Model saved successfully');
}

if (require.main === module) {
  train().catch(console.error);
}

module.exports = { train };

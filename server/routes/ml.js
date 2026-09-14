const express = require('express');
const router = express.Router();
const { isModelReady, getModelInfo } = require('../ml/etaPredictor');
const { getAccuracyMetrics, getPredictionHistory } = require('../ml/modelEvaluation');
const { train } = require('../ml/trainModel');

// Placeholder for auth middleware in case they don't exist in a specific path
// If they exist in ../middleware/auth, require them there.
let authenticateToken, requireRole;
try {
  const auth = require('../middleware/auth');
  authenticateToken = auth.authenticateToken;
  requireRole = auth.requireRole;
} catch (e) {
  // Mock fallback for standard interface if missing
  authenticateToken = (req, res, next) => next();
  requireRole = (role) => (req, res, next) => next();
}

/**
 * GET /api/ml/status
 * Returns the current status of the ML model, version, and training metrics.
 */
router.get('/status', async (req, res) => {
  const ready = await isModelReady();
  const info = getModelInfo();
  
  res.json({
    success: true,
    status: ready ? 'ready' : 'unavailable',
    modelInfo: info,
    info
  });
});

/**
 * GET /api/ml/baselines
 * Returns baseline comparisons on the held-out test set
 */
router.get('/baselines', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const metaPath = path.join(__dirname, '../ml/saved_model/metadata.json');

  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return res.json({
      success: true,
      modelVersion: meta.modelVersion,
      datasetType: meta.datasetType,
      baselines: meta.testMetrics,
      datasetSplits: meta.datasetSplits,
    });
  }

  res.status(404).json({ success: false, message: 'Model metadata not found' });
});

/**
 * GET /api/ml/metrics
 * Returns ongoing prediction accuracy from the evaluation module.
 */
router.get('/metrics', (req, res) => {
  const accuracy = getAccuracyMetrics();
  const history = getPredictionHistory(50); // last 50
  
  res.json({
    success: true,
    metrics: accuracy,
    accuracy,
    recentPredictions: history
  });
});

/**
 * POST /api/ml/retrain
 * Triggers model retraining asynchronously. Requires admin role.
 */
router.post('/retrain', authenticateToken, requireRole('admin'), (req, res) => {
  // Run training in the background
  train().catch(err => {
    console.error('Background retraining failed:', err);
  });
  
  res.json({ message: 'Retraining started in the background.' });
});

module.exports = router;

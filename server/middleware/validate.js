const Joi = require('joi');

/**
 * Creates a validation middleware from a Joi schema.
 * @param {Object} schema - Object with optional keys: body, params, query
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationErrors = [];

    for (const key of ['body', 'params', 'query']) {
      if (schema[key]) {
        const { error } = schema[key].validate(req[key], {
          abortEarly: false,
          stripUnknown: true,
        });
        if (error) {
          validationErrors.push(
            ...error.details.map((detail) => ({
              field: detail.path.join('.'),
              message: detail.message,
            }))
          );
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors,
      });
    }

    next();
  };
};

// ─── Validation Schemas ───────────────────────────────────────────

const schemas = {
  // Auth schemas
  register: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).max(128).required(),
      name: Joi.string().min(2).max(100).required(),
      phone: Joi.string().min(10).max(15).required(),
      userType: Joi.string().valid('conductor', 'passenger').required(),
      busNumber: Joi.string().when('userType', {
        is: 'conductor',
        then: Joi.string().required(),
        otherwise: Joi.string().optional(),
      }),
    }),
  },

  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  },

  // Bus schemas
  updateLocation: {
    body: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      speed: Joi.number().min(0).max(200).optional(),
      direction: Joi.number().min(0).max(360).optional(),
      accuracy: Joi.number().min(0).optional(),
    }),
  },

  startRoute: {
    body: Joi.object({
      routeId: Joi.string().required(),
    }),
  },

  // Route schemas
  createRoute: {
    body: Joi.object({
      routeName: Joi.string().min(2).max(200).required(),
      routeNumber: Joi.string().min(1).max(20).required(),
      description: Joi.string().max(500).optional().allow(''),
      stops: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            location: Joi.object({
              latitude: Joi.number().min(-90).max(90).required(),
              longitude: Joi.number().min(-180).max(180).required(),
            }).required(),
            estimatedTime: Joi.number().min(0).required(),
          })
        )
        .min(2)
        .required(),
      createdBy: Joi.string().optional(),
    }),
  },

  // Emergency schemas
  createEmergency: {
    body: Joi.object({
      busId: Joi.string().required(),
      conductorId: Joi.string().required(),
      alertType: Joi.string()
        .valid('medical', 'accident', 'breakdown', 'security', 'other')
        .required(),
      description: Joi.string().max(1000).optional().allow(''),
      priority: Joi.string()
        .valid('low', 'medium', 'high', 'critical')
        .default('high'),
      location: Joi.object({
        latitude: Joi.number().min(-90).max(90),
        longitude: Joi.number().min(-180).max(180),
      }).optional(),
    }),
  },

  updateEmergencyStatus: {
    body: Joi.object({
      status: Joi.string()
        .valid('active', 'acknowledged', 'resolved')
        .required(),
      resolvedBy: Joi.string().optional(),
      notes: Joi.string().max(1000).optional().allow(''),
    }),
  },

  // Tracking schemas
  predictArrival: {
    body: Joi.object({
      busId: Joi.string().required(),
      passengerLat: Joi.number().min(-90).max(90).required(),
      passengerLon: Joi.number().min(-180).max(180).required(),
      destinationStopId: Joi.string().required(),
    }),
  },

  nearbyQuery: {
    query: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      radius: Joi.number().min(0.1).max(50).default(2),
    }),
  },

  // Param schemas
  mongoId: {
    params: Joi.object({
      id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({ 'string.pattern.base': 'Invalid ID format' }),
    }),
  },
};

module.exports = {
  validate,
  schemas,
};

const StatusCode = Object.freeze({
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,

  INTERNAL_SERVER: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
});

const Messages = Object.freeze({
  SUCCESS: 'Success',
  CREATED: 'Created Successfully',
  UPDATED: 'Updated Successfully',
  DELETED: 'Deleted Successfully',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  DUPLICATE_ENTRY: 'Resource already exists',
  INVALID_CREDENTIALS: 'Invalid credentials',
  INVALID_REQUEST: 'Invalid request parameters',
});

module.exports = { StatusCode, Messages };

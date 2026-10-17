const ApiError = require('../utils/ApiError');

/** validate(zodSchema, 'body' | 'query' | 'params') - replaces the source with the parsed (coerced, stripped) value. */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const first = errors[0];
    return next(new ApiError(400, first ? `${first.field ? `${first.field}: ` : ''}${first.message}` : 'Invalid input', errors));
  }
  if (source === 'query') {
    // req.query may be read-only in some setups; keep parsed copy separately
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};

module.exports = validate;

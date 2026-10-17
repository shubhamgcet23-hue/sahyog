const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const idParam = z.object({ id: objectId });

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const optionalNumber = z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : v), z.coerce.number().optional());
const optionalDate = z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : v), z.coerce.date().optional());
const optionalString = (max) => z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(max).optional());
const pageQuery = { page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional() };

module.exports = { objectId, idParam, lat, lng, optionalNumber, optionalDate, optionalString, pageQuery };

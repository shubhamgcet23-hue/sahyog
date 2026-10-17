const { z } = require('zod');
const { lat, lng, optionalDate, optionalString, pageQuery } = require('./common');

const base = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.string().trim().toLowerCase().min(1, 'Category is required'),
  subcategory: optionalString(60),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']),
  availabilityType: z.enum(['BORROW', 'DONATE', 'SHARE']),
  quantity: z.coerce.number().int('Quantity must be a whole number').min(1).max(10000),
  lat,
  lng,
  areaLabel: optionalString(120),
  addressDetail: optionalString(300),
  availableFrom: optionalDate,
  availableTo: optionalDate,
};

const dateOrder = (d) => !d.availableFrom || !d.availableTo || d.availableTo >= d.availableFrom;
const dateMsg = { message: 'Available-to date must be after available-from', path: ['availableTo'] };

const create = z.object(base).refine(dateOrder, dateMsg);

const removeImages = z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string()).max(10));
const update = z
  .object({
    ...Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.optional ? v.optional() : v])),
    removeImages,
  })
  .refine(dateOrder, dateMsg);

const list = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().toLowerCase().optional(),
  type: z.enum(['BORROW', 'DONATE', 'SHARE']).optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
  availability: z.enum(['available', 'all']).default('available'),
  sort: z.enum(['newest', 'nearest']).default('newest'),
  lat: lat.optional(),
  lng: lng.optional(),
  radiusKm: z.coerce.number().min(0.5).max(500).default(25),
  owner: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  ...pageQuery,
});

const nearby = z.object({
  lat,
  lng,
  radiusKm: z.coerce.number().min(0.5).max(500).default(10),
  category: z.string().trim().toLowerCase().optional(),
  type: z.enum(['BORROW', 'DONATE', 'SHARE']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

module.exports = { create, update, list, nearby };

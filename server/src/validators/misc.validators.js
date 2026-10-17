const { z } = require('zod');
const { objectId, lat, lng, optionalDate, optionalString, pageQuery } = require('./common');

// ---- messaging ----
const createConversation = z
  .object({ requestId: objectId.optional(), emergencyId: objectId.optional(), withUser: objectId.optional() })
  .refine((d) => d.requestId || d.emergencyId, { message: 'requestId or emergencyId is required' });
const sendMessage = z.object({ content: z.string().trim().min(1, 'Message cannot be empty').max(2000) });
const messagesQuery = z.object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).default(40) });

// ---- notifications ----
const notificationsQuery = z.object({ unread: z.enum(['true', 'false']).optional(), ...pageQuery });

// ---- reviews / reports ----
const createReview = z.object({
  requestId: objectId,
  rating: z.coerce.number().int().min(1).max(5),
  comment: optionalString(1000),
});
const createReport = z.object({
  targetType: z.enum(['USER', 'RESOURCE', 'REVIEW', 'EMERGENCY']),
  targetId: objectId,
  reason: z.enum(['SPAM', 'FRAUD', 'ABUSIVE', 'UNSAFE', 'INAPPROPRIATE', 'OTHER']),
  description: optionalString(1000),
});
const appeal = z.object({ message: z.string().trim().min(10, 'Please explain your appeal (at least 10 characters)').max(1000) });

// ---- emergencies ----
const emergencyBase = {
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(140),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.string().trim().toLowerCase().min(1, 'Category is required'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  quantity: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.number().int().min(1).max(100000).optional()),
  needBy: optionalDate,
  lat,
  lng,
  areaLabel: optionalString(120),
  contactPreference: z.enum(['IN_APP_ONLY', 'SHARE_PHONE_AFTER_MATCH']).default('IN_APP_ONLY'),
};
const createEmergency = z.object(emergencyBase);
const updateEmergency = z.object({
  title: emergencyBase.title.optional(),
  description: emergencyBase.description.optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  quantity: emergencyBase.quantity,
  needBy: optionalDate,
  contactPreference: z.enum(['IN_APP_ONLY', 'SHARE_PHONE_AFTER_MATCH']).optional(),
  removeImages: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string()).max(10)),
});
const emergencyList = z.object({
  category: z.string().trim().toLowerCase().optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'MATCHED', 'FULFILLED', 'CLOSED']).optional(),
  mine: z.enum(['true', 'false']).optional(),
  responded: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
  lat: lat.optional(),
  lng: lng.optional(),
  radiusKm: z.coerce.number().min(0.5).max(500).default(50),
  ...pageQuery,
});
const emergencyStatus = z.object({ status: z.enum(['OPEN', 'UNDER_REVIEW', 'MATCHED', 'FULFILLED', 'CLOSED']), note: optionalString(300) });
const emergencyRespond = z.object({
  message: z.string().trim().min(3, 'Please add a short message').max(800),
  offerType: z.enum(['DONATE', 'LEND', 'VOLUNTEER', 'INFO']).default('DONATE'),
  quantity: z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.number().int().min(1).optional()),
});
const emergencyResponseUpdate = z.object({ status: z.enum(['ACCEPTED', 'DECLINED', 'WITHDRAWN']) });

// ---- organizations ----
const orgVerification = z.object({ message: optionalString(1000) });

// ---- admin ----
const adminUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['USER', 'ORGANIZATION', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  ...pageQuery,
});
const adminUserStatus = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: optionalString(300) });
const adminOrgDecision = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: optionalString(500) });
const adminReportsQuery = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
  targetType: z.enum(['USER', 'RESOURCE', 'REVIEW', 'EMERGENCY']).optional(),
  appeal: z.enum(['PENDING']).optional(),
  ...pageQuery,
});
const adminReportDecision = z.object({
  status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
  action: z.enum(['NONE', 'WARN', 'HIDE_CONTENT', 'SUSPEND_USER']).optional(),
  note: optionalString(500),
  reverseRewards: z.boolean().optional(),
  appealDecision: z.enum(['UPHELD', 'OVERTURNED']).optional(),
});
const adminResourcesQuery = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'HIDDEN']).optional(), ...pageQuery });
const adminResourceModeration = z.object({ status: z.enum(['AVAILABLE', 'HIDDEN']), reason: optionalString(300) });
const categoryBody = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and dashes').max(60).optional(),
  description: optionalString(200),
  subcategories: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});
const categoryUpdate = categoryBody.partial();
const rangeQuery = z.object({ range: z.enum(['week', 'month', 'year']).default('month') });

module.exports = {
  createConversation, sendMessage, messagesQuery, notificationsQuery, createReview, createReport, appeal,
  createEmergency, updateEmergency, emergencyList, emergencyStatus, emergencyRespond, emergencyResponseUpdate,
  orgVerification, adminUsersQuery, adminUserStatus, adminOrgDecision, adminReportsQuery, adminReportDecision,
  adminResourcesQuery, adminResourceModeration, categoryBody, categoryUpdate, rangeQuery,
};

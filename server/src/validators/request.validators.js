const { z } = require('zod');
const { objectId, optionalDate, optionalString, pageQuery } = require('./common');

const create = z.object({
  resourceId: objectId,
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  message: optionalString(1000),
  intendedUse: z.enum(['PERSONAL', 'EDUCATION', 'HEALTHCARE', 'COMMUNITY_EVENT', 'OTHER']).default('PERSONAL'),
  handoverMethod: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  handoverNote: optionalString(300),
  proposedReturnDate: optionalDate,
});

const updateStatus = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED']),
  note: optionalString(300),
});

const note = z.object({ note: optionalString(300) });

const list = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  type: z.enum(['BORROW', 'DONATE', 'SHARE']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  ...pageQuery,
});

module.exports = { create, updateStatus, note, list };

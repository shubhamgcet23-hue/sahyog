const { z } = require('zod');
const { optionalString } = require('./common');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const phone = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number').optional()
);

const register = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password,
    phone,
    role: z.enum(['USER', 'ORGANIZATION']).default('USER'),
    organizationDetails: z
      .object({
        orgName: z.string().trim().min(2).max(120),
        orgType: z.enum(['HOSPITAL', 'SCHOOL', 'NGO', 'COMMUNITY', 'OTHER']),
        registrationNumber: optionalString(60),
        website: optionalString(200),
        description: optionalString(1000),
      })
      .optional(),
  })
  .refine((d) => d.role !== 'ORGANIZATION' || d.organizationDetails, {
    message: 'Organization details are required for organization accounts',
    path: ['organizationDetails'],
  });

const login = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(200),
});

const changePassword = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: password,
});

const forgotPassword = z.object({ email: z.string().trim().toLowerCase().email() });
const resetPassword = z.object({ token: z.string().min(10).max(200), password });
const verifyEmail = z.object({ token: z.string().min(10).max(200) });

const updateProfile = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone,
  bio: optionalString(500),
  areaLabel: optionalString(120),
  lat: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
  organizationDetails: z
    .object({
      orgName: z.string().trim().min(2).max(120).optional(),
      orgType: z.enum(['HOSPITAL', 'SCHOOL', 'NGO', 'COMMUNITY', 'OTHER']).optional(),
      registrationNumber: optionalString(60),
      website: optionalString(200),
      description: optionalString(1000),
    })
    .optional(),
});

module.exports = { register, login, changePassword, forgotPassword, resetPassword, verifyEmail, updateProfile };

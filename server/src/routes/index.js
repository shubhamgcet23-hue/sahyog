const express = require('express');
const mongoose = require('mongoose');
const { protect, protectAllowSuspended, optionalAuth, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { authLimiter, sensitiveLimiter } = require('../middleware/rateLimit');
const { idParam } = require('../validators/common');
const v = require('../validators/auth.validators');
const rv = require('../validators/resource.validators');
const qv = require('../validators/request.validators');
const mv = require('../validators/misc.validators');
const { z } = require('zod');

const auth = require('../controllers/auth.controller');
const users = require('../controllers/user.controller');
const resources = require('../controllers/resource.controller');
const requests = require('../controllers/request.controller');
const conversations = require('../controllers/conversation.controller');
const notifications = require('../controllers/notification.controller');
const emergencies = require('../controllers/emergency.controller');
const reviews = require('../controllers/review.controller');
const reports = require('../controllers/report.controller');
const organizations = require('../controllers/organization.controller');
const publicCtl = require('../controllers/public.controller');
const admin = require('../controllers/admin.controller');

const router = express.Router();
const params = validate(idParam, 'params');
const adminOnly = [protect, authorize('ADMIN')];

// ---- health & public ----
router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', uptime: process.uptime() }));
router.get('/categories', publicCtl.categories);
router.get('/impact', validate(mv.rangeQuery, 'query'), publicCtl.impact);

// ---- auth ----
router.post('/auth/register', authLimiter, validate(v.register), auth.register);
router.post('/auth/login', authLimiter, validate(v.login), auth.login);
router.post('/auth/logout', auth.logout);
router.post('/auth/logout-all', protect, auth.logoutAll);
router.get('/auth/me', protectAllowSuspended, auth.me);
router.get('/auth/socket-token', protect, auth.socketToken);
router.patch('/auth/change-password', protect, authLimiter, validate(v.changePassword), auth.changePassword);
router.post('/auth/forgot-password', authLimiter, validate(v.forgotPassword), auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, validate(v.resetPassword), auth.resetPassword);
router.post('/auth/verify-email', validate(v.verifyEmail), auth.verifyEmail);

// ---- users ----
router.get('/users/me', protect, users.getMe);
router.patch('/users/me', protect, upload.avatar, validate(v.updateProfile), users.updateMe);
router.get('/users/me/activity', protect, users.activity);
router.get('/users/me/resources', protect, users.myResources);
router.get('/users/me/pending-reviews', protect, users.pendingReviews);
router.get('/users/me/rewards', protect, users.rewards);
router.get('/users/me/moderations', protectAllowSuspended, reports.againstMe);
router.get('/users/:id', protect, params, users.getPublicProfile);
router.get('/users/:id/reviews', protect, params, users.getUserReviews);

// ---- resources ----
router.get('/resources', optionalAuth, validate(rv.list, 'query'), resources.list);
router.get('/resources/nearby', optionalAuth, validate(rv.nearby, 'query'), resources.nearby);
router.post('/resources', protect, authorize('USER', 'ORGANIZATION'), upload.images, validate(rv.create), resources.create);
router.get('/resources/:id', optionalAuth, params, resources.get);
router.patch('/resources/:id', protect, params, upload.images, validate(rv.update), resources.update);
router.delete('/resources/:id', protect, params, resources.remove);

// ---- requests ----
router.post('/requests', protect, validate(qv.create), requests.create);
router.get('/requests/me', protect, validate(qv.list, 'query'), requests.mine);
router.get('/requests/received', protect, validate(qv.list, 'query'), requests.received);
router.get('/requests/:id', protect, params, requests.get);
router.patch('/requests/:id/status', protect, params, validate(qv.updateStatus), requests.updateStatus);
router.post('/requests/:id/cancel', protect, params, validate(qv.note), requests.cancel);
router.post('/requests/:id/complete', protect, params, validate(qv.note), requests.complete);

// ---- messaging ----
router.get('/conversations', protect, conversations.list);
router.post('/conversations', protect, validate(mv.createConversation), conversations.open);
router.get('/conversations/:id/messages', protect, params, validate(mv.messagesQuery, 'query'), conversations.messages);
router.post('/conversations/:id/messages', protect, params, validate(mv.sendMessage), conversations.send);
router.post('/conversations/:id/read', protect, params, conversations.read);
router.patch('/conversations/:id/read', protect, params, conversations.read);

// ---- notifications ----
router.get('/notifications', protect, validate(mv.notificationsQuery, 'query'), notifications.list);
router.patch('/notifications/read-all', protect, notifications.readAll);
router.patch('/notifications/:id/read', protect, params, notifications.markRead);

// ---- emergencies ----
router.get('/emergencies', protect, validate(mv.emergencyList, 'query'), emergencies.list);
router.post('/emergencies', protect, upload.images, validate(mv.createEmergency), emergencies.create);
router.get('/emergencies/:id', protect, params, emergencies.get);
router.patch('/emergencies/:id', protect, params, upload.images, validate(mv.updateEmergency), emergencies.update);
router.post('/emergencies/:id/respond', protect, params, validate(mv.emergencyRespond), emergencies.respond);
router.patch('/emergencies/:id/responses/:responseId', protect, validate(z.object({ id: idParam.shape.id, responseId: idParam.shape.id }), 'params'), validate(mv.emergencyResponseUpdate), emergencies.updateResponse);
router.patch('/emergencies/:id/status', protect, params, validate(mv.emergencyStatus), emergencies.status);

// ---- reviews & reports ----
router.post('/reviews', protect, sensitiveLimiter, validate(mv.createReview), reviews.create);
router.post('/reports', protect, sensitiveLimiter, validate(mv.createReport), reports.create);
router.get('/reports/against-me', protectAllowSuspended, reports.againstMe);
router.post('/reports/:id/appeal', protectAllowSuspended, params, validate(mv.appeal), reports.appeal);

// ---- organizations ----
router.post('/organizations/verification', protect, authorize('ORGANIZATION'), sensitiveLimiter, upload.documents, validate(mv.orgVerification), organizations.submitVerification);
router.get('/organizations/verification', protect, authorize('ORGANIZATION'), organizations.myVerification);

// ---- admin ----
router.use('/admin', adminOnly);
router.get('/admin/overview', admin.overview);
router.get('/admin/users', validate(mv.adminUsersQuery, 'query'), admin.users);
router.patch('/admin/users/:id/status', params, validate(mv.adminUserStatus), admin.setUserStatus);
router.get('/admin/organizations/pending', admin.pendingOrganizations);
router.patch('/admin/organizations/:id/verification', params, validate(mv.adminOrgDecision), admin.decideOrganization);
router.get('/admin/reports', validate(mv.adminReportsQuery, 'query'), admin.reports);
router.patch('/admin/reports/:id', params, validate(mv.adminReportDecision), admin.decideReport);
router.get('/admin/resources', validate(mv.adminResourcesQuery, 'query'), admin.resources);
router.patch('/admin/resources/:id/moderation', params, validate(mv.adminResourceModeration), admin.moderateResource);
router.get('/admin/emergencies', admin.emergencies);
router.get('/admin/categories', admin.categories);
router.post('/admin/categories', validate(mv.categoryBody), admin.createCategory);
router.patch('/admin/categories/:id', params, validate(mv.categoryUpdate), admin.updateCategory);
router.delete('/admin/categories/:id', params, admin.deleteCategory);
router.get('/admin/audit-logs', admin.auditLogs);
router.get('/admin/analytics', validate(mv.rangeQuery, 'query'), admin.analytics);

module.exports = router;

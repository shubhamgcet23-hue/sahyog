/* Demo data: node src/utils/seed.js [--reset]  (or: npm run seed / npm run seed:reset) */
const mongoose = require('mongoose');
const { env, validateEnv } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const models = require('../models');
const { ensureDefaults } = require('../services/categoryService');
const trust = require('../services/trustService');
const rewards = require('../services/rewardService');
const { toPoint } = require('./geo');

const { User, Resource, ResourceRequest, Review, EmergencyRequest, Notification, Category, Conversation, Message, Report, OrgVerification, RewardTransaction, AuditLog } = models;

// Greater Noida / Delhi-NCR demo coordinates (lat, lng)
const SPOTS = [
  ['Knowledge Park II, Greater Noida', 28.4744, 77.5040],
  ['Alpha 1, Greater Noida', 28.4691, 77.5202],
  ['Pari Chowk, Greater Noida', 28.4595, 77.5122],
  ['Sector 62, Noida', 28.6273, 77.3649],
  ['Sector 18, Noida', 28.5706, 77.3218],
  ['Chandni Chowk, Delhi', 28.6506, 77.2303],
];

const PASSWORD = 'Sahyog@123';

/** Create the demo data. Assumes mongoose is already connected. Returns false when data already exists. */
async function seedDemo({ reset = false, quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  if (reset) {
    await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
    log('Existing data removed.');
  } else if (await User.exists({ email: 'admin@sahyog.local' })) {
    log('Seed data already present. Use --reset to rebuild.');
    return false;
  }
  await Promise.all(Object.values(models).map((m) => m.init()));
  await ensureDefaults();
  const hash = await User.hashPassword(PASSWORD);

  const mk = (name, email, extra = {}) => User.create({ name, email, passwordHash: hash, emailVerified: true, ...extra });
  const admin = await mk('Sahyog Admin', 'admin@sahyog.local', { role: 'ADMIN' });
  const [asha, ravi, meera, karan] = await Promise.all([
    mk('Asha Verma', 'asha@sahyog.local', { phone: '+919800000001', areaLabel: SPOTS[0][0], location: toPoint(SPOTS[0][1], SPOTS[0][2]), bio: 'Teacher who loves sharing books.' }),
    mk('Ravi Kumar', 'ravi@sahyog.local', { phone: '+919800000002', areaLabel: SPOTS[1][0], location: toPoint(SPOTS[1][1], SPOTS[1][2]) }),
    mk('Meera Singh', 'meera@sahyog.local', { areaLabel: SPOTS[2][0], location: toPoint(SPOTS[2][1], SPOTS[2][2]) }),
    mk('Karan Patel', 'karan@sahyog.local', { areaLabel: SPOTS[3][0], location: toPoint(SPOTS[3][1], SPOTS[3][2]) }),
  ]);
  const ngo = await mk('Helping Hands Foundation', 'ngo@sahyog.local', {
    role: 'ORGANIZATION', areaLabel: SPOTS[4][0], location: toPoint(SPOTS[4][1], SPOTS[4][2]),
    organizationDetails: { orgName: 'Helping Hands Foundation', orgType: 'NGO', registrationNumber: 'NGO-2019-0042', website: 'https://example.org', description: 'Community NGO distributing essentials.', verificationStatus: 'VERIFIED', verifiedAt: new Date() },
  });
  const clinic = await mk('City Care Clinic', 'clinic@sahyog.local', {
    role: 'ORGANIZATION', areaLabel: SPOTS[5][0], location: toPoint(SPOTS[5][1], SPOTS[5][2]),
    organizationDetails: { orgName: 'City Care Clinic', orgType: 'HOSPITAL', registrationNumber: 'HOSP-77231', description: 'Neighbourhood clinic awaiting verification.', verificationStatus: 'PENDING' },
  });
  await OrgVerification.create({ organization: clinic._id, message: 'Please verify our clinic so we can post emergency requests.' });

  const spot = (i) => ({ areaLabel: SPOTS[i][0], location: toPoint(SPOTS[i][1], SPOTS[i][2]) });
  const rs = await Resource.insertMany([
    { owner: asha._id, title: 'Class 10 NCERT Textbook Set', description: 'Complete set of Class 10 NCERT books in good condition, light highlighting only.', category: 'books', condition: 'GOOD', availabilityType: 'DONATE', quantity: 2, availableQuantity: 2, ...spot(0) },
    { owner: asha._id, title: 'Scientific Calculator (Casio fx-991)', description: 'Works perfectly. Happy to lend for exam season - please return in a week or two.', category: 'school-supplies', condition: 'LIKE_NEW', availabilityType: 'BORROW', quantity: 1, availableQuantity: 1, ...spot(0) },
    { owner: ravi._id, title: 'Cordless Drill with Bit Set', description: 'Bosch cordless drill with a bit set and charger. Borrow for home repair jobs.', category: 'tools', condition: 'GOOD', availabilityType: 'BORROW', quantity: 1, availableQuantity: 1, ...spot(1) },
    { owner: ravi._id, title: 'Winter Jackets (kids, 6-10 yrs)', description: 'Five lightly used winter jackets for children, washed and ready to donate.', category: 'clothing', condition: 'GOOD', availabilityType: 'DONATE', quantity: 5, availableQuantity: 5, ...spot(1) },
    { owner: meera._id, title: 'Badminton Racket Pair + Shuttles', description: 'Two rackets and a tube of shuttlecocks. Share them at the community court.', category: 'sports', condition: 'FAIR', availabilityType: 'SHARE', quantity: 1, availableQuantity: 1, ...spot(2) },
    { owner: karan._id, title: 'Study Table and Chair', description: 'Wooden study table with a matching chair, free to a student who can pick up.', category: 'furniture', condition: 'GOOD', availabilityType: 'DONATE', quantity: 1, availableQuantity: 1, ...spot(3) },
    { owner: ngo._id, title: 'Wheelchair (foldable)', description: 'Foldable wheelchair available to borrow for recovery periods. Sanitised after each use.', category: 'medical-equipment', condition: 'GOOD', availabilityType: 'BORROW', quantity: 2, availableQuantity: 2, ...spot(4) },
    { owner: ngo._id, title: 'Dry Ration Kits', description: 'Rice, dal, oil and flour kits for families in need. Collected from our centre.', category: 'food', condition: 'NEW', availabilityType: 'DONATE', quantity: 20, availableQuantity: 20, ...spot(4) },
    { owner: karan._id, title: 'Old Laptop (i5, 8GB)', description: 'Refurbished laptop suitable for online classes. Charger included.', category: 'electronics', condition: 'FAIR', availabilityType: 'DONATE', quantity: 1, availableQuantity: 1, ...spot(3) },
  ]);

  // A completed exchange (with reviews + rewards), plus an active borrow and a pending request
  const [textbooks, calculator, drill, , , , wheelchair] = rs;
  const snap = (r) => ({ title: r.title, category: r.category, availabilityType: r.availabilityType });
  const daysAgo = (n) => new Date(Date.now() - n * 86400000);
  const done = await ResourceRequest.create({
    resource: textbooks._id, requester: ravi._id, owner: asha._id, requestType: 'DONATE', quantity: 1, message: 'For my nephew, thank you!', status: 'COMPLETED',
    resourceSnapshot: snap(textbooks), approvedAt: daysAgo(5), startedAt: daysAgo(4), completedAt: daysAgo(3),
    statusHistory: ['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'].map((status) => ({ status, by: asha._id })),
  });
  await Resource.updateOne({ _id: textbooks._id }, { $set: { quantity: 1, availableQuantity: 1 } });
  await rewards.award({ userId: asha._id, type: 'DONATION_COMPLETED', requestId: done._id, description: 'Completed donate: Class 10 NCERT Textbook Set' });
  await Review.create({ request: done._id, reviewer: ravi._id, reviewee: asha._id, rating: 5, comment: 'Very kind and punctual. Books were in great shape!' });
  await Review.create({ request: done._id, reviewer: asha._id, reviewee: ravi._id, rating: 5, comment: 'Smooth pickup, thank you.' });

  const active = await ResourceRequest.create({
    resource: drill._id, requester: meera._id, owner: ravi._id, requestType: 'BORROW', quantity: 1, status: 'APPROVED', message: 'Need to hang shelves this weekend.',
    proposedReturnDate: new Date(Date.now() + 5 * 86400000), resourceSnapshot: snap(drill), approvedAt: new Date(),
    statusHistory: ['PENDING', 'APPROVED'].map((status) => ({ status, by: ravi._id })),
  });
  await Resource.updateOne({ _id: drill._id }, { $set: { availableQuantity: 0, status: 'UNAVAILABLE' } });
  const pending = await ResourceRequest.create({
    resource: calculator._id, requester: karan._id, owner: asha._id, requestType: 'BORROW', quantity: 1, status: 'PENDING', message: 'Board exam prep.',
    proposedReturnDate: new Date(Date.now() + 10 * 86400000), resourceSnapshot: snap(calculator), statusHistory: [{ status: 'PENDING', by: karan._id }],
  });
  for (const r of [active, pending, done]) {
    const conv = await Conversation.create({ key: `req:${r._id}`, participants: [r.requester, r.owner], relatedRequest: r._id });
    const m = await Message.create({ conversation: conv._id, sender: r.requester, content: r.message || 'Hello!', readBy: [r.requester] });
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessage: { content: m.content, sender: m.sender }, lastMessageAt: m.createdAt } });
  }
  await Notification.create({ recipient: asha._id, type: 'REQUEST_NEW', title: 'New borrow request', message: 'Karan Patel requested 1 x "Scientific Calculator (Casio fx-991)"', relatedRequest: pending._id, link: `/requests/${pending._id}` });
  await Notification.create({ recipient: meera._id, type: 'REQUEST_APPROVED', title: 'Request approved', message: 'Ravi approved your request for the drill.', relatedRequest: active._id, link: `/requests/${active._id}` });

  // Emergency requests
  await EmergencyRequest.create({
    creator: ngo._id, title: 'Blankets needed for flood-relief camp', description: 'We are sheltering 40 families and need warm blankets by this weekend. Drop-off at our centre or coordinate via chat.',
    category: 'clothing', urgency: 'HIGH', quantity: 60, ...spot(4), urgencyRank: 1, statusHistory: [{ status: 'OPEN', by: ngo._id }],
  });
  await EmergencyRequest.create({
    creator: meera._id, title: 'Wheelchair needed for elderly parent after surgery', description: 'Looking for a wheelchair for 3-4 weeks while my father recovers. Can collect from anywhere nearby.',
    category: 'medical-equipment', urgency: 'MEDIUM', quantity: 1, ...spot(2), urgencyRank: 2, statusHistory: [{ status: 'OPEN', by: meera._id }],
    responses: [{ responder: ngo._id, offerType: 'LEND', message: 'We can lend a foldable wheelchair - see our listing.', quantity: 1 }],
  });

  // a report so the moderation queue is not empty
  await Report.create({ reporter: karan._id, targetType: 'RESOURCE', targetId: wheelchair._id, reportedUser: ngo._id, reason: 'OTHER', description: 'Demo report: please confirm sanitation process is described.' });

  await Promise.all([asha, ravi, meera, karan, ngo, clinic].map((u) => trust.recompute(u._id)));
  await AuditLog.create({ admin: admin._id, action: 'seed.run', details: { note: 'Demo data created' } });

  log('\nSeed complete. Demo accounts (password for all: %s)\n', PASSWORD);
  log('  admin@sahyog.local   (Admin)\n  asha@sahyog.local    (User)\n  ravi@sahyog.local    (User)\n  meera@sahyog.local   (User)\n  karan@sahyog.local   (User)\n  ngo@sahyog.local     (Verified organization)\n  clinic@sahyog.local  (Organization, verification pending)\n');
  return true;
}

async function main() {
  validateEnv();
  await connectDB();
  await seedDemo({ reset: process.argv.includes('--reset') });
  await disconnectDB();
}

module.exports = { seedDemo, PASSWORD };

if (require.main === module) {
  main().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
}

const crypto = require('crypto');

const { env, validateEnv } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Resource } = require('../models');
const { ensureDefaults } = require('../services/categoryService');
const { toPoint } = require('../utils/geo');

// Require an explicit confirmation before modifying the production database.
if (env.isProd && !process.argv.includes('--confirm-showcase')) {
  console.error(
    'Production safeguard: rerun with --confirm-showcase after reviewing this script.'
  );
  process.exit(1);
}

const SHOWCASE_EMAILS = {
  member: 'showcase.member@sahyog-demo.invalid',
  neighbour: 'showcase.neighbour@sahyog-demo.invalid',
  community: 'showcase.community@sahyog-demo.invalid',
};

const PEOPLE = [
  {
    key: 'member',
    name: 'Sahyog Demo Member',
    email: SHOWCASE_EMAILS.member,
    areaLabel: 'Alpha 1, Greater Noida',
    lat: 28.4691,
    lng: 77.5202,
  },
  {
    key: 'neighbour',
    name: 'Sahyog Demo Neighbour',
    email: SHOWCASE_EMAILS.neighbour,
    areaLabel: 'Knowledge Park II, Greater Noida',
    lat: 28.4744,
    lng: 77.5040,
  },
  {
    key: 'community',
    name: 'Sahyog Demo Community Centre',
    email: SHOWCASE_EMAILS.community,
    role: 'ORGANIZATION',
    areaLabel: 'Sector 18, Noida',
    lat: 28.5706,
    lng: 77.3218,
    organizationDetails: {
      orgName: 'Sahyog Demo Community Centre',
      orgType: 'COMMUNITY',
      description: 'Sample organization profile for the Sahyog showcase.',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    },
  },
];

const SAMPLE_NOTE =
  'DEMO DATA ONLY: This sample listing demonstrates the Sahyog platform. ' +
  'It is not a real offer. Please do not submit an actual request for this item.';

const LISTINGS = [
  {
    owner: 'member',
    title: '[DEMO] Class 10 NCERT Textbook Set',
    description: 'Sample educational book donation in good condition.',
    category: 'books',
    condition: 'GOOD',
    availabilityType: 'DONATE',
    quantity: 2,
  },
  {
    owner: 'member',
    title: '[DEMO] Scientific Calculator',
    description: 'Sample calculator listing for students during exam season.',
    category: 'school-supplies',
    condition: 'LIKE_NEW',
    availabilityType: 'BORROW',
    quantity: 1,
  },
  {
    owner: 'neighbour',
    title: '[DEMO] Cordless Drill and Bit Set',
    description: 'Sample household tool listing for a short-term loan.',
    category: 'tools',
    condition: 'GOOD',
    availabilityType: 'BORROW',
    quantity: 1,
  },
  {
    owner: 'neighbour',
    title: '[DEMO] Winter Jackets for Children',
    description: 'Sample clothing donation listing for families.',
    category: 'clothing',
    condition: 'GOOD',
    availabilityType: 'DONATE',
    quantity: 5,
  },
  {
    owner: 'member',
    title: '[DEMO] Badminton Rackets and Shuttles',
    description: 'Sample sports equipment available to share.',
    category: 'sports',
    condition: 'FAIR',
    availabilityType: 'SHARE',
    quantity: 1,
  },
  {
    owner: 'neighbour',
    title: '[DEMO] Study Table and Chair',
    description: 'Sample furniture listing for students.',
    category: 'furniture',
    condition: 'GOOD',
    availabilityType: 'DONATE',
    quantity: 1,
  },
  {
    owner: 'community',
    title: '[DEMO] Foldable Wheelchair',
    description: 'Sample medical-equipment listing for the showcase.',
    category: 'medical-equipment',
    condition: 'GOOD',
    availabilityType: 'BORROW',
    quantity: 2,
  },
  {
    owner: 'community',
    title: '[DEMO] Dry Ration Kits',
    description: 'Sample food and grocery listing for community sharing.',
    category: 'food',
    condition: 'NEW',
    availabilityType: 'DONATE',
    quantity: 10,
  },
  {
    owner: 'neighbour',
    title: '[DEMO] Refurbished Laptop',
    description: 'Sample electronics listing for demonstrating discovery.',
    category: 'electronics',
    condition: 'FAIR',
    availabilityType: 'DONATE',
    quantity: 1,
  },
];

async function getOrCreatePerson(person) {
  let user = await User.findOne({ email: person.email });

  if (user) {
    if (
      user.name !== person.name ||
      user.role !== (person.role || 'USER')
    ) {
      throw new Error(
        `Showcase account conflict for ${person.email}. No records were deleted.`
      );
    }

    return user;
  }

  // Unpredictable password: sample accounts are not intended for sign-in.
  const password = crypto.randomBytes(48).toString('hex');

  user = await User.create({
    name: person.name,
    email: person.email,
    passwordHash: await User.hashPassword(password),
    emailVerified: true,
    role: person.role || 'USER',
    areaLabel: person.areaLabel,
    location: toPoint(person.lat, person.lng),
    ...(person.organizationDetails
      ? { organizationDetails: person.organizationDetails }
      : {}),
  });

  return user;
}

async function main() {
  validateEnv();
  await connectDB();

  try {
    await ensureDefaults();

    const peopleByKey = {};

    for (const person of PEOPLE) {
      peopleByKey[person.key] = await getOrCreatePerson(person);
    }

    let created = 0;
    let skipped = 0;

    for (const item of LISTINGS) {
      const owner = peopleByKey[item.owner];

      // Makes repeated runs safe: don't recreate an existing showcase listing.
      const alreadyExists = await Resource.exists({
        owner: owner._id,
        title: item.title,
      });

      if (alreadyExists) {
        skipped += 1;
        continue;
      }

      await Resource.create({
        owner: owner._id,
        title: item.title,
        description: `${SAMPLE_NOTE}\n\n${item.description}`,
        category: item.category,
        condition: item.condition,
        availabilityType: item.availabilityType,
        quantity: item.quantity,
        availableQuantity: item.quantity,
        status: 'AVAILABLE',
        location: toPoint(item.owner === 'community' ? 28.5706 :
          item.owner === 'member' ? 28.4691 : 28.4744,
          item.owner === 'community' ? 77.3218 :
          item.owner === 'member' ? 77.5202 : 77.5040),
        areaLabel: owner.areaLabel,
      });

      created += 1;
    }

    console.log('Showcase seeding completed.');
    console.log(`New sample listings: ${created}`);
    console.log(`Existing sample listings skipped: ${skipped}`);
    console.log('No existing users or records were deleted.');
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error('Showcase seeding failed:', error.message);
  process.exitCode = 1;
});
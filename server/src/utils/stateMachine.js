/**
 * Pure state machines (easy to unit-test).
 * Actors: 'owner' | 'requester' | 'creator' | 'responder' | 'admin'
 */
const REQUEST_TRANSITIONS = {
  PENDING: { APPROVED: ['owner'], REJECTED: ['owner'], CANCELLED: ['requester'] },
  APPROVED: { IN_PROGRESS: ['owner'], CANCELLED: ['owner', 'requester'] },
  IN_PROGRESS: { COMPLETED: ['owner'] },
  REJECTED: {},
  CANCELLED: {},
  COMPLETED: {},
};

const EMERGENCY_TRANSITIONS = {
  OPEN: { UNDER_REVIEW: ['admin'], MATCHED: ['creator'], CLOSED: ['creator', 'admin'] },
  UNDER_REVIEW: { OPEN: ['admin'], CLOSED: ['creator', 'admin'] },
  MATCHED: { FULFILLED: ['creator'], OPEN: ['creator'], CLOSED: ['creator', 'admin'], UNDER_REVIEW: ['admin'] },
  FULFILLED: { CLOSED: ['creator', 'admin'] },
  CLOSED: {},
};

const can = (table, from, to, actor) => Boolean(table[from] && table[from][to] && table[from][to].includes(actor));

module.exports = {
  REQUEST_TRANSITIONS,
  EMERGENCY_TRANSITIONS,
  canRequestTransition: (from, to, actor) => can(REQUEST_TRANSITIONS, from, to, actor),
  canEmergencyTransition: (from, to, actor) => can(EMERGENCY_TRANSITIONS, from, to, actor),
  ACTIVE_REQUEST_STATUSES: ['PENDING', 'APPROVED', 'IN_PROGRESS'],
};

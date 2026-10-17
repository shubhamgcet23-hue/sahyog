const { canRequestTransition, canEmergencyTransition } = require('../../src/utils/stateMachine');

describe('request state machine', () => {
  test('owner can approve or reject a pending request; requester cannot', () => {
    expect(canRequestTransition('PENDING', 'APPROVED', 'owner')).toBe(true);
    expect(canRequestTransition('PENDING', 'REJECTED', 'owner')).toBe(true);
    expect(canRequestTransition('PENDING', 'APPROVED', 'requester')).toBe(false);
  });
  test('requester can cancel pending/approved; owner cannot cancel pending', () => {
    expect(canRequestTransition('PENDING', 'CANCELLED', 'requester')).toBe(true);
    expect(canRequestTransition('APPROVED', 'CANCELLED', 'requester')).toBe(true);
    expect(canRequestTransition('PENDING', 'CANCELLED', 'owner')).toBe(false);
  });
  test('only the owner completes an in-progress exchange', () => {
    expect(canRequestTransition('IN_PROGRESS', 'COMPLETED', 'owner')).toBe(true);
    expect(canRequestTransition('IN_PROGRESS', 'COMPLETED', 'requester')).toBe(false);
  });
  test('cannot skip states or leave terminal states', () => {
    expect(canRequestTransition('PENDING', 'COMPLETED', 'owner')).toBe(false);
    expect(canRequestTransition('APPROVED', 'COMPLETED', 'owner')).toBe(false);
    ['REJECTED', 'CANCELLED', 'COMPLETED'].forEach((s) => {
      ['PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].forEach((to) => {
        expect(canRequestTransition(s, to, 'owner')).toBe(false);
      });
    });
  });
});

describe('emergency state machine', () => {
  test('creator can close, admin can put under review', () => {
    expect(canEmergencyTransition('OPEN', 'CLOSED', 'creator')).toBe(true);
    expect(canEmergencyTransition('OPEN', 'UNDER_REVIEW', 'admin')).toBe(true);
    expect(canEmergencyTransition('OPEN', 'UNDER_REVIEW', 'creator')).toBe(false);
  });
  test('only the creator can mark a matched request fulfilled', () => {
    expect(canEmergencyTransition('MATCHED', 'FULFILLED', 'creator')).toBe(true);
    expect(canEmergencyTransition('MATCHED', 'FULFILLED', 'admin')).toBe(false);
    expect(canEmergencyTransition('OPEN', 'FULFILLED', 'creator')).toBe(false);
  });
});

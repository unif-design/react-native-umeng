import { navigationReducer } from '../navigation';

describe('navigationReducer', () => {
  it('appends a destination without mutating the existing stack', () => {
    const state = { stack: ['setup'] as const };

    expect(
      navigationReducer(state, { type: 'navigate', route: 'home' })
    ).toEqual({ stack: ['setup', 'home'] });
    expect(state).toEqual({ stack: ['setup'] });
  });

  it('keeps the root route when back cannot pop another entry', () => {
    expect(navigationReducer({ stack: ['setup'] }, { type: 'back' })).toEqual({
      stack: ['setup'],
    });
  });

  it('removes only the current route when navigating back', () => {
    expect(
      navigationReducer(
        { stack: ['setup', 'home', 'platforms'] },
        { type: 'back' }
      )
    ).toEqual({ stack: ['setup', 'home'] });
  });

  it('replaces the entire stack when resetting', () => {
    expect(
      navigationReducer(
        { stack: ['setup', 'home', 'logs'] },
        { type: 'reset', route: 'setup' }
      )
    ).toEqual({ stack: ['setup'] });
  });
});

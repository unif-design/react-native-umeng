export type RouteId =
  | 'setup'
  | 'home'
  | 'platforms'
  | 'sheet'
  | 'direct'
  | 'analytics'
  | 'logs';

export type NavigationState = {
  readonly stack: readonly RouteId[];
};

export type NavigationAction =
  | { type: 'navigate'; route: RouteId }
  | { type: 'back' }
  | { type: 'reset'; route: RouteId };

function assertNever(action: never): never {
  throw new Error(`未知导航操作: ${JSON.stringify(action)}`);
}

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction
): NavigationState {
  switch (action.type) {
    case 'navigate':
      return { stack: [...state.stack, action.route] };
    case 'back':
      return state.stack.length > 1
        ? { stack: state.stack.slice(0, -1) }
        : state;
    case 'reset':
      return { stack: [action.route] };
    default:
      return assertNever(action);
  }
}

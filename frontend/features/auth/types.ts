export type LoginActionState = {
  errorMessage: string | null;
};

export type LogoutActionState = {
  errorMessage: string | null;
};

export const INITIAL_LOGIN_ACTION_STATE: LoginActionState = {
  errorMessage: null,
};

export const INITIAL_LOGOUT_ACTION_STATE: LogoutActionState = {
  errorMessage: null,
};

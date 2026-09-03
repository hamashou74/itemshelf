export const AUTH_TRANSPORT = {
  csrf: {
    cookieName: "csrftoken",
    headerName: "X-CSRFToken",
  },
  session: {
    cookieName: "sessionid",
  },
} as const;

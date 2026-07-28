// Every non-"/" and non-"/pricing" path falls through to <App /> in main.tsx (no router).
// "/app" is just a conventional entry path for that fallthrough — App itself renders
// AuthPage when unauthenticated and Dashboard when signed in, regardless of pathname.
export const APP_ENTRY_HREF = "/app";

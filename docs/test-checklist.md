# Manual test checklist

Browser checks that complement the automated tests. Run them against `npm run dev` (or the deployed URL) with the seeded accounts in the README. Later tasks add sections; T7.3 runs the whole list.

Last run: 2026-10-31 (T2.6), local dev server against the dev database, Chrome, at 1360px and 390px wide.

## Sign-in and portals (AUTH-01, AUTH-02, AUTH-03, AUTH-07)

- [x] Logged out, `/`, `/author` and `/admin/...` all redirect to `/login`.
- [x] Submitting the empty form shows "Enter your email address." and "Enter your password." next to the fields, and focus moves to Email.
- [x] A wrong password shows "We couldn't sign you in" without saying whether the email exists.
- [x] The button shows "Signing in…" and the form is disabled while the request runs.
- [x] An admin (`support.lead@bookleaf.example`) lands on `/admin` (dark "Support desk" header, name shown).
- [x] An author (AUTH001's account) lands on `/author` (light "Author portal" header, name shown).
- [x] Signed in, `/login` and the other portal's URLs (`/author` as admin, `/admin/tickets/...` as author) redirect to the user's own portal.
- [x] `document.cookie` in the console doesn't show the session cookie (HttpOnly).
- [x] "Sign out" returns to `/login`; `/author`, `/admin` and `/api/auth/me` then need a new sign-in, and Back doesn't reopen the portal.
- [x] At phone width the login brand panel is hidden, and the portal nav moves to its own row under the header.

## My tickets (TICKET-06, TICKET-07, AUTH-06)

- [x] `/author/tickets` lists the author's tickets, most recent activity first, with subject, book (or "General / Account Level"), status badge and last update (IST).
- [x] An author with no tickets sees "No queries yet" with a "Raise a query" button.
- [x] A ticket shows the original query and the replies, oldest first, from "BookLeaf Support" with the sender's name and time; line breaks are kept.
- [x] A ticket without replies says "No replies yet…".
- [x] An unknown ticket ID, or another author's ticket ID, shows "We couldn't find that ticket".
- [x] Lists and tickets read well at phone width.

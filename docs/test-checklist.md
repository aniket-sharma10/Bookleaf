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

## Raise a query (TICKET-01, TICKET-02, TICKET-04)

- [x] The book list shows the author's books (in-production ones labelled "(in production)") plus "General / Account Level"; nothing is preselected.
- [x] Submitting an empty form shows all field errors at once and focuses the first.
- [x] A server-side 400 (another author's book ID, forced by editing the option in DevTools) appears on the book field.
- [x] Subject and details show live character counts.
- [x] Chosen attachment names are listed, with the note that attachments aren't uploaded.
- [x] A valid submission opens the new ticket (Open, no replies), and it appears in My tickets.

## Dashboard and My books (BOOK-01 to BOOK-07)

- [x] Stat cards show book count (with published / in production), royalty earned, paid and pending (sums of the book values) and open queries, with a link to My tickets.
- [x] AUTH007's in-production book shows "In production · Cover Design", "Not yet published", "—" for MRP, ₹0 amounts and "No payout yet".
- [x] Only AUTH009 sees the payout-threshold hint (₹850 pending, below ₹1,000).
- [x] Wide screens show a table with a totals row; phones show one card per book with every field, including print partner and platforms.
- [x] No `null`, `NaN` or "Invalid Date" anywhere (AUTH002, AUTH007, AUTH009).
- [x] The loading skeleton and the error state with "Try again" render (forced in DevTools).

## Admin queue (QUEUE-01 to QUEUE-05)

- [x] `/admin` shows unresolved tickets by default: "Needs triage" first, then Critical → Low, oldest first.
- [x] Each row shows priority (or "Needs triage"), subject, author, book, category, status, assignee ("You" for yourself) and an age badge that warms after 2 and 7 days.
- [x] Changing a filter updates the URL; opening a filtered URL restores the filters; "Clear filters" resets them.
- [x] A filter with no matches shows "No tickets match these filters".
- [x] At phone width, rows become cards with all the same information.

## Admin ticket page (MGMT-01, MGMT-03, AI-03, AI-04)

- [x] Opening a queue row shows the query, the conversation, a Manage panel, and author and book facts.
- [x] Changing status, category or priority saves immediately ("Saving…") and survives a reload.
- [x] "Assign to me" sets the assignee to "You" and disappears.
- [x] A failed save shows the error under that control and the select returns to the saved value.
- [x] AI hints read "No AI suggestion yet" while classification is pending.

## Replies and internal notes (MGMT-02, MGMT-04, MGMT-05, DRAFT-03)

- [x] Sending an empty reply or note shows "Write something first." and sends nothing.
- [x] A reply appears in the conversation; an Open ticket moves to In Progress unless another status was chosen.
- [x] Notes appear in the amber "Only visible to BookLeaf team" panel.
- [x] With a second browser signed in as the author: after a refresh the reply and new status show; the note does not.

## AI drafts and classification (AI-01, AI-07, DRAFT-01, DRAFT-02, DRAFT-05, DRAFT-08)

- [x] With AI disabled: a new ticket stays "Needs triage"; the ticket page shows "AI draft unavailable — write a reply manually"; "Retry AI classification" explains that AI isn't configured; a manual reply still sends.
- [x] With AI enabled: a new ticket is classified within seconds; opening a ticket without a draft shows "Drafting…" and then fills the editor with a draft greeting the author by first name.
- [x] The draft panel lists what the reply promises, what to check before sending, and any warnings.
- [x] "Regenerate" asks before replacing edited text; dismissing keeps the edits.
- [x] A reply sent from a draft records the draft; the draft is then marked as written before the latest message.
- [x] "Retry AI classification" fills category and priority for an untriaged ticket and disappears.

## Near-real-time updates (RT-01, RT-02)

- [x] With the author's ticket open in one browser, an admin reply (and status change) sent from another appears within about 5 s, without a reload.
- [x] A ticket raised by an author appears in an open admin queue within about 15 s.
- [x] Text being typed in the admin reply box is never replaced by a refresh.
- [x] If a refresh fails, the page stays (with "Couldn't refresh just now…") and recovers by itself.

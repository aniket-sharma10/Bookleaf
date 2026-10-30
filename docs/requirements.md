# Requirements — Author Support & Communication Portal

The source of truth is the assignment brief (PDF) and `bookleaf_sample_data.json`. Both are kept **locally only and are git-ignored**. This document restates the requirements in our own words so the implementation never has to guess.

> **Public repository.** This repo is public (confirmed with BookLeaf HR). Committed files must not reproduce the brief or dataset verbatim. Requirements are paraphrased, dataset records are referred to by ID, and expected values in tests are loaded from the local JSON at runtime rather than hard-coded.

**Priority legend**

| Priority | Meaning |
|---|---|
| **Mandatory** | Explicitly required by the brief. |
| **Bonus** | Named as optional or bonus by the brief. |
| **Derived** | Not stated literally, but needed to satisfy a mandatory requirement or the project's security rules. The rationale is given. |
| **Recommended** | A product or quality choice we propose. It can be dropped without breaking the assignment. |

`Src` gives the section of the brief: A = Author Portal, B = Admin Portal, C = API Layer, D = AI Integration, KB = Knowledge Base, DS = Sample Dataset, TG = Technology Guidelines, SUB = Submission, EV = Evaluation, IN = Important Notes. `Brief` means the project owner's planning brief.

---

## 1. Authentication and role-based authorization (AUTH)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| AUTH-01 | Authors log in with email and password. No OTP, social login or external provider. | Mandatory | A | Each seeded author can log in with their dataset email and the documented demo password. A wrong password returns 401 with a generic message that does not reveal whether the email exists. | `authors[].email` |
| AUTH-02 | Admins (BookLeaf ops team) log in with email and password. | Derived | B | Seeded admin accounts can log in and reach `/admin`. *The dataset has no admins, so the seed creates them. This is an assumption.* | — |
| AUTH-03 | Logout clears the session cookie. | Derived | A | After logout the browser has no session cookie, and API calls return 401. *The JWT itself stays valid until it expires, so expiry is kept short (§5 of the architecture). This is a documented limitation.* | — |
| AUTH-04 | Every API route except login requires a valid session. The JWT is verified server-side: signature, pinned algorithm, issuer, audience, expiry and claim shape. | Mandatory | C | Every `/api/**` route except `POST /api/auth/login` returns 401 `UNAUTHENTICATED` for a missing, tampered, expired or wrongly signed token. An automated test enumerates the routes. | — |
| AUTH-05 | Role-based access: admin endpoints are admin-only and author endpoints are author-only. | Mandatory | C | An author calling `/api/admin/**` gets 403. An admin calling `/api/author/**` gets 403. | — |
| AUTH-06 | Authors only access their own data, even if they change IDs in the URL or body. The author ID always comes from the verified token, never from the client. | Mandatory | A, C | Author A requesting author B's ticket gets 404. Creating a ticket with B's `bookId` is rejected. Lists never include another author's records. Covered by tests. | `author_id`, `book_id` |
| AUTH-07 | Portal pages redirect unauthenticated users to `/login`, and wrong-role users to their own portal. | Derived | A, B | Visiting `/admin` as an author redirects to `/author`. Visiting either portal while logged out redirects to `/login`. | — |
| AUTH-08 | Passwords are stored only as bcrypt hashes. The JWT lives only in an `HttpOnly` cookie (`Secure` in production, `SameSite=Lax`). It is never in `localStorage` and never readable by client JavaScript. The signing secret is server-only. | Derived | Brief | The DB has no plaintext passwords. The cookie flags are asserted in tests. `document.cookie` does not show the token. | — |

## 2. Author dashboard, books and royalties (BOOK, DATA)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| DATA-01 | Seed the **exact** supplied dataset: all 10 authors and 18 books with their original IDs. No record or field is invented, altered or dropped. | Mandatory | DS | A seed verification compares every field of every record with the local JSON. Re-running the seed creates no duplicates. | whole file |
| DATA-02 | Values are preserved exactly as supplied. Royalty figures are not recalculated, masked ISBNs are not normalised or validated, and strings (including non-ASCII punctuation) are kept unchanged. | Mandatory | DS | Verification compares strings exactly and numbers exactly. Nullable fields stay null. Empty `available_on` arrays stay empty. | all |
| BOOK-01 | "My Books" lists the logged-in author's books with these fields: title, ISBN, genre, publication date, status, MRP, total copies sold, total royalty earned, royalty paid and royalty pending. | Mandatory | A | Every book of the author is shown with all 10 fields, **including books still in production**. | `books[]` |
| BOOK-02 | Books still in production (BK013, BK015) are shown, not dropped. A null publication date or MRP is displayed as "Not yet published" or "—", and the stage comes from `status`. | Mandatory | DS, EV | No `null`, `NaN` or "Invalid Date" appears anywhere. | `status`, `mrp`, `publication_date` |
| BOOK-03 | Books with zero paid royalty or no payout date yet (BK005, BK010, BK013, BK015, BK016, BK018) are shown clearly. | Mandatory | DS, EV | These show ₹0 paid and "No payout yet". | `royalty_paid`, `last_royalty_payout_date` |
| BOOK-04 | Fully paid books (pending = 0: BK002, BK007, BK008, BK014, plus both in-production books) show ₹0 pending normally. | Mandatory | DS | Zero is shown as ₹0, not as an error or a blank. | `royalty_pending` |
| BOOK-05 | After login, authors land on a simple dashboard summarising their account, with links to books and tickets. | Mandatory | A | Shows name, book count, totals of earned, paid and pending (sums of the supplied values), open ticket count, and links. | `books[]` |
| BOOK-06 | INR formatting uses Indian digit grouping, and dates use one consistent format. | Recommended | — | Formatting helpers are unit-tested. | — |
| BOOK-07 | Show the last payout date and print partner. Hint when an author's total pending amount is below the payout threshold. | Recommended | KB | Only authors below the threshold (currently AUTH009) see the hint. | `royalty_pending`, KB |

## 3. Support ticket creation and author ticket history (TICKET)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| TICKET-01 | The ticket form has a book selector (the author's own books plus "General / Account Level"), a subject and a detailed description. | Mandatory | A | The dropdown lists only the author's books, including in-production ones. "General / Account Level" is stored as `bookId = null`. | `books[]` |
| TICKET-02 | Optional attachment control, UI only. | Mandatory | A | A file picker shows the selected file names, with a notice that files are not uploaded. | — |
| TICKET-03 | Real attachment upload. | Bonus | A | Deferred. | — |
| TICKET-04 | Server-side validation: subject and description are required, with length limits. `bookId` must belong to the requesting author. | Mandatory | C | Invalid input returns 400 `VALIDATION_ERROR` with field details. Another author's `bookId` is rejected. | `book_id` |
| TICKET-05 | A new ticket is created as **Open** and is stored even if AI classification fails. | Mandatory | B, D | With the AI failing or unconfigured, creation still returns 201 and the ticket is persisted. | — |
| TICKET-06 | "My Tickets" lists all of the author's tickets with their current status. | Mandatory | A | Subject, book (or General), status and last update, sorted newest first. An empty state is shown when there are none. | — |
| TICKET-07 | The ticket view shows the original query and all admin responses in order. | Mandatory | A | The detail view shows subject, description, book, status and the response thread. | — |
| TICKET-08 | Authors never see internal notes, AI drafts, AI metadata, priority or assignee. | Derived | B | Author API responses contain none of these fields. Asserted in a test. | — |
| TICKET-09 | Authors can reply to, or close, their own tickets. | Recommended | — | Not required. Deferred. | — |

## 4. Admin ticket queue, filters and prioritisation (QUEUE)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| QUEUE-01 | The admin queue lists tickets from all authors. | Mandatory | B | Shows author, book, subject, category, priority, status, assignee and age. | — |
| QUEUE-02 | Filter by status, category, priority and created-date range. Filters can be combined. | Mandatory | B | API tests cover each filter and combinations of them. | — |
| QUEUE-03 | The most urgent and oldest unresolved tickets are easy to spot. | Mandatory | B | The default view shows unresolved tickets (Open and In Progress), sorted by priority (Critical first) and then oldest first. Priority and age are visually distinct. | — |
| QUEUE-04 | Unclassified tickets (AI pending or failed) are flagged "Needs triage" and never hidden. | Derived | D | A ticket whose classification failed appears in the default view with a badge. | — |
| QUEUE-05 | Pagination. | Recommended | — | `page` and `pageSize` parameters, with `pageSize` capped at 100. | — |

## 5. AI classification and priority scoring (AI)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| AI-01 | When a ticket is created, an AI model classifies it into exactly one of the six categories (§11). | Mandatory | B | A valid category is stored. Output outside the enum counts as a failure. | — |
| AI-02 | AI assigns a priority (Critical, High, Medium or Low) based on content. A long-running missing-royalty complaint must rank above a cosmetic profile-update request. | Mandatory | B | Our own evaluation query set (T5.9) ranks these correctly. ISBN errors are at least High, per KB policy. | KB |
| AI-03 | The admin can override the AI category. | Mandatory | B | `PATCH` changes the category. The AI's original suggestion is kept. | — |
| AI-04 | The admin can override the AI priority. | Mandatory | B | Same as AI-03. | — |
| AI-05 | Structured JSON output is validated server-side before it is used. | Derived | D | Malformed output is logged as `INVALID_OUTPUT` and nothing is persisted. | — |
| AI-06 | Admin overrides are never overwritten by AI, whether from a late classification or a retry. | Derived | B | Tested. | — |
| AI-07 | Classification failure (timeout, rate limit, provider error, missing key) leaves the ticket usable: it is unclassified, the admin can set values manually, and retry is available. | Mandatory | D | Fake-provider tests cover timeout, 429 and malformed output. | — |
| AI-08 | Cost-aware classification: one call returns both category and priority, uses a small model and truncated input, and runs once per ticket unless an admin retries. | Mandatory | D | Token usage is recorded per call. One provider call per ticket creation. | — |
| AI-09 | The API key is read only from a server-side environment variable. It is never hard-coded, sent to the client, logged or committed. | Mandatory | D | Repository and client bundle grep is clean. AI modules import `server-only`. | — |

## 6. AI-drafted responses and admin review (DRAFT)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| DRAFT-01 | When an admin opens a ticket, an AI draft based on the query **and** the Knowledge Base is presented. | Mandatory | B | Opening a ticket without a draft triggers generation, with a loading state. The draft appears in the editor. | KB, ticket |
| DRAFT-02 | The admin edits the draft before sending. Nothing is ever auto-sent. | Mandatory | B | Only an explicit admin "Send" creates an author-visible message. | — |
| DRAFT-03 | The sent response appears in the author's ticket view. | Mandatory | B | The author detail endpoint returns it (see RT-01). | — |
| DRAFT-04 | Drafts are grounded only in verified application data (the ticket, the author's own book records, and code-derived policy facts) and the runtime KB module. No invented numbers, dates, platforms or policies. | Mandatory | KB, D | The prompt contains only allow-listed facts. Prompt-construction tests check this. | `books[]`, KB |
| DRAFT-05 | Drafts never claim that an action (escalation, re-sync, reprint, refund, payment, …) **has already happened** unless the application has a record that it was performed. The app currently records no such actions, so drafts may only commit to future actions. Those commitments are listed separately for the admin to confirm. | Mandatory | Brief | Structured output has `commitments[]` and `needsVerification[]`. A deterministic check flags completed-action phrasing and amounts that are not in the context. | — |
| DRAFT-06 | Tone follows the KB communication guidelines (§14). | Mandatory | KB, D | The system prompt encodes the guidelines. Evaluation drafts are reviewed manually. | KB |
| DRAFT-07 | Token-aware context: only the KB sections relevant to the category, only the referenced book (or a compact summary for General), truncated text and recent replies, no internal notes, and no PII beyond the author's first name. Drafts are cached and regenerated only on request. | Mandatory | D | Context-builder tests check which sections are included and the size bounds. Token usage is recorded. | — |
| DRAFT-08 | When AI fails, the admin sees "draft unavailable" and can reply manually. | Mandatory | D | A failing provider produces 503 `AI_UNAVAILABLE`, and the composer still sends. | — |
| DRAFT-09 | Ticket text is treated as untrusted data (prompt-injection resistance). | Derived | Brief | User content is delimited in the prompt. Output is schema-bound. No tool calling. | — |

## 7. Ticket status, assignment, internal notes and responses (MGMT)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| MGMT-01 | The admin sets status to Open, In Progress, Resolved or Closed. | Mandatory | B | `PATCH` updates it, and the author sees the new status. | — |
| MGMT-02 | Internal notes are visible to admins only. | Mandatory | B | Notes live in a separate table, are never selected by author endpoints, and this is tested. | — |
| MGMT-03 | An admin can assign a ticket **to themselves**. Assigning to other admins or unassigning is not required. | Mandatory | B | The endpoint assigns only the caller. Any other assignee value gets 400. | — |
| MGMT-04 | The admin can send a manual response without AI. | Mandatory | D | The composer works with AI disabled. | — |
| MGMT-05 | The first response to an Open ticket moves it to In Progress, unless the admin picks another status. | Recommended | — | Tested. | — |

## 8. REST API, validation and error handling (API)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| API-01 | Frontend and backend communicate through a clean REST API with consistent naming. | Mandatory | C | All UI reads and mutations go through `/api/**`. | — |
| API-02 | Bodies, path parameters and query strings are validated with meaningful errors, not generic 500s. | Mandatory | C | Invalid input returns 400 `{ error: { code, message, details } }`. Unknown IDs return 404. | — |
| API-03 | Consistent error envelope and status codes (400, 401, 403, 404, 409, 503, 500 only when unexpected). | Mandatory | C | Tests cover each code. | — |
| API-04 | Every endpoint is documented. | Mandatory | C, SUB | `docs/api.md` covers every route file. | — |
| API-05 | CSRF protection on mutations: SameSite cookie plus an Origin check. | Derived | Brief | A cross-origin `POST` gets 403. | — |

## 9. Near-real-time updates (RT)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| RT-01 | Admin responses and status changes appear in the author's open ticket view and list without a manual refresh. Polling is acceptable. | Mandatory | A, TG | With two browsers, the author sees the reply within about 5 s and no reload. | — |
| RT-02 | The admin queue refreshes periodically. | Recommended | — | A new ticket appears within about 15 s. | — |

## 10. Testing, deployment, documentation and deliverables (DEL)

| ID | Requirement | Priority | Src | Acceptance criterion | Data deps |
|---|---|---|---|---|---|
| DEL-01 | The source code is in a GitHub repository with the reviewer as collaborator (email pending). The brief asks for a private repo, but BookLeaf HR has confirmed this repo may be **public**. The brief and dataset must still never be committed. | Mandatory | SUB, IN | Collaborator invited. `git ls-files` shows no PDF, dataset JSON or `.env`. | — |
| DEL-02 | Clean commit history. | Recommended | SUB | One commit per task. | — |
| DEL-03 | A live URL with both portals, pre-seeded with the exact dataset. | Mandatory | SUB, DS | Live smoke test passes. `db:verify` passes against production. | all |
| DEL-04 | Test credentials are in the README. | Mandatory | SUB | They work on the live demo. | — |
| DEL-05 | README: local setup, architecture decisions, AI integration (prompts, error handling, cost), API docs, limitations. | Mandatory | SUB | Every topic has a section. | — |
| DEL-06 | Brief justification of the model choice. | Mandatory | D | Section present. | — |
| DEL-07 | A write-up of at most one page: priorities, trade-offs and how this becomes production-ready. | Mandatory | SUB | `docs/write-up.md`, about 500 words or fewer. | — |
| DEL-08 | Automated Vitest tests cover authorization, validation, AI failure paths and seeding. They use mocked AI, **only the dedicated test database**, and **synthetic data only** (never the confidential dataset). | Derived | Brief, EV | `npm test` passes offline without `GEMINI_API_KEY`. It refuses to run against a non-test database. | — |
| DEL-09 | No secrets in the repo. `.env.example` documents every variable. | Mandatory | D | Grep is clean. `.env*` is ignored except the example. | — |
| DEL-10 | Every line can be explained by the owner. | Mandatory | IN | The code stays small and conventional. | — |

---

## 11. Exact enumerations

**Ticket categories** (canonical labels from the Admin Portal section):

| Enum value | Label |
|---|---|
| `ROYALTY_PAYMENTS` | Royalty & Payments |
| `ISBN_METADATA` | ISBN & Metadata Issues |
| `PRINTING_QUALITY` | Printing & Quality |
| `DISTRIBUTION_AVAILABILITY` | Distribution & Availability |
| `BOOK_STATUS_PRODUCTION` | Book Status & Production Updates |
| `GENERAL_INQUIRY` | General Inquiry |

**Priorities:** `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. Declared in this order so that database ordering puts Critical first.

**Ticket statuses:** `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. No transition rules are specified, so admins may set any status (assumption).

**Book statuses in the dataset** (free text, stored verbatim): `Published & Live`, `In Production - Cover Design`, `In Production - Typesetting`.

**Production stages (KB), in order:** Manuscript Received → Editing (optional) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.

## 12. Dataset structure (inspected)

Top level: `{ "authors": Author[] }`. There are 10 authors and 18 books. `author_id`, author `email`, `book_id` and `isbn` are unique within the dataset.

**Author fields:** `author_id`, `name`, `email`, `phone`, `city`, `joined_date` (ISO date), `books[]`.

**Book fields (all 15 are stored):**

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `book_id` | string | no | Kept as the primary key. |
| `title` | string | no | May contain non-ASCII punctuation. |
| `isbn` | string | no | **Masked placeholder.** Stored verbatim and never validated. A unique constraint is kept. |
| `genre` | string | no | Free text. |
| `publication_date` | ISO date | **yes** | |
| `status` | string | no | See §11. |
| `mrp` | integer ₹ | **yes** | |
| `author_royalty_per_copy` | integer ₹ | **yes** | Not in the required display list. Useful context for drafts. |
| `total_copies_sold` | integer | no | |
| `total_royalty_earned` | integer ₹ | no | Stored as supplied, never recalculated. |
| `royalty_paid` | integer ₹ | no | Stored as supplied. |
| `royalty_pending` | integer ₹ | no | Stored as supplied. |
| `last_royalty_payout_date` | ISO date | **yes** | |
| `print_partner` | string | **yes** | |
| `available_on` | string[] | no, **may be empty** | Platform names. |

All money values are whole rupees. The most recent payout date in the data suggests a snapshot from late 2025.

**Not in the dataset** (do not invent): passwords, admin users, tickets, bank details, per-platform sales, per-quarter royalty history, production-stage timestamps, publishing package.

## 13. Dataset edge cases

| Case | Books | Handling |
|---|---|---|
| In production: null date, MRP, per-copy royalty and partner; no platforms; zero sales | BK013, BK015 | Displayed and selectable in the ticket form. Drafts use the stage from `status` and never invent dates. |
| Published, nothing paid yet, payout date null | BK005, BK010, BK016, BK018 | "No payout yet". Drafts must not call the payment overdue or scheduled without admin verification. |
| Fully paid (pending ₹0) | BK002, BK007, BK008, BK014 | Displayed normally. |
| Author's total pending below the ₹1,000 threshold | AUTH009 | The roll-over policy applies. |
| Author with both published and in-production books | AUTH007, AUTH009 | Dashboard totals must handle nulls. |
| Masked ISBNs | all | Verbatim, no validation. |

## 14. Knowledge base — policy facts the AI must follow

This is a concise structured summary, not a copy of the brief. At runtime it lives in `src/server/ai/knowledge-base.ts` in the same structured form. **Add no policy that is not listed here.**

| Section | Facts |
|---|---|
| Company | Self-publishing in India and the US. Two packages: Standard Free (no upfront cost) and Bestseller Breakthrough (paid; adds marketing and distribution). BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management. In-house printing and warehouse in Delhi. Print partners: Repro India and Epitome Books. |
| Royalty | The author receives 80% of net profit per book and BookLeaf 20%. Net profit = MRP − printing − platform commission − shipping. Calculated quarterly and paid within 45 days of quarter end. Minimum payout ₹1,000; smaller amounts roll over to the next quarter. Paid by bank transfer to the account linked in the author's dashboard. The dashboard offers a per-platform royalty breakdown. |
| ISBN | BookLeaf assigns a unique ISBN under its own imprint. A personal imprint needs an ISBN the author obtains independently. ISBN errors (duplicate, wrong book linked) are high priority and escalated to the production team. |
| Printing & quality | Mostly printed in-house, with overflow or special formats going to partners. Standard turnaround is 5–7 business days from order confirmation. Verified quality defects (misprints, binding, colour) get a free reprint. Photos of the defect may be requested. |
| Distribution | Sold on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store. New listings go live 7–10 business days after publication. "Unavailable" usually means a stock sync issue, and a re-sync takes 24–48 hours. |
| Production | Stages are listed in §11. Authors get an email at each stage. Common delays are cover design (waiting for author approval) and proofreading (revision rounds). |
| Metadata updates | Changes to a book's listing (e.g. its description) after it goes live can be requested through the dashboard or by email to the team. They take 3–5 business days to show. |
| Tone | Empathetic and professional; authors are partners. Acknowledge the concern first. Be specific with numbers, dates and statuses. Own BookLeaf's mistakes without deflecting. Give a concrete timeline for anything that needs investigation (e.g. 48 hours). Always end with a clear next step. |

**Per-category handling guidance** (our summary of the brief's examples; used to calibrate prompts, not quoted):
- **Royalty:** explain the quarterly cycle and the 45-day window, ask the author to confirm their bank details are linked, and give the next payout deadline. If underpayment is suspected, explain the net-profit formula and offer a detailed breakdown. If a payment may be overdue, commit to investigating within 48 hours.
- **ISBN & metadata:** treat as high priority, commit to escalating to production, 48-hour timeline.
- **Printing & quality:** apologise, request photos, commit to a free reprint once verified, 5–7 business days.
- **Distribution:** explain the stock-sync cause, commit to requesting a re-sync, 24–48 hours.
- **Production updates:** state the actual stage from the data and be honest about the cause of any delay. Give a timeline without blaming the author.
- **General:** answer from policy (e.g. the metadata-update process).

### 14.1 Policy ambiguities and the recommended handling

| Ambiguity | Recommendation |
|---|---|
| A "specific next payout date" is expected, but the policy only gives a deadline, and the dataset's payout dates don't line up with it. | Code computes the **next upcoming policy deadline**: 45 days after the most recent quarter end, or the following one if that has passed. The deadlines fall on 15 May, 14 Aug, 14 Nov and 14 Feb. The draft says "by <date>". |
| Is a payment "overdue"? There is no per-quarter history, and the data is a historical snapshot. | The AI never asserts "overdue". It adds "verify payout status" to `needsVerification`. |
| Bank details are not in the data. | The draft asks the author to confirm, or flags it for the admin. It never asserts either way. |
| Is the threshold per author or per book? | Per author ("accumulated royalties"). Used only for hints and context. |
| The KB mentions dashboard features this portal lacks (bank linking, per-platform breakdown, metadata edits). | Drafts may describe BookLeaf's processes but must not claim that data exists in this portal. |
| Priority rubric: only examples are given. | A recommended rubric is in architecture §6.3, calibrated with our own query set. |
| No admin users or passwords in the data. | The seed creates two admin accounts. Demo passwords come from env. Credentials are listed in the README. |

## 15. Deliverables and confidentiality

1. A GitHub repo (public, per HR) with the reviewer as collaborator and a clean history.
2. A live URL with both portals, seeded with the exact dataset, and test credentials in the README.
3. A README covering setup, architecture decisions, AI integration (prompts, error handling, cost), model choice, API docs and limitations.
4. A write-up of at most one page.
5. A follow-up walkthrough, in which the owner can explain every line.

**Confidentiality:** the PDF and the raw JSON are never committed (`.gitignore`). Committed docs and code paraphrase requirements and KB facts and never reproduce the brief verbatim. Tests and the seed read dataset values from the local JSON at runtime.

**Evaluation emphasis:** AI integration and architecture/code quality carry the most weight. If time is short, prioritise the core ticket flow and AI integration over nice-to-haves.

# API reference

The portal's UI uses this REST API for every read and write. Route handlers live in `src/app/api/**/route.ts`, request schemas in `src/lib/schemas/`, response types in `src/lib/api-types.ts`. Design notes are in [architecture §4](architecture.md#4-rest-api).

Examples use made-up values.

## Conventions

### Authentication

- `POST /api/auth/login` is the only public endpoint. On success it sets the session cookie:

  ```
  Set-Cookie: bl_session=<JWT>; Path=/; Max-Age=28800; HttpOnly; SameSite=Lax; Secure
  ```

  `Secure` is set in production only. The token is never returned in a response body.
- Every other endpoint needs that cookie. Browsers send it automatically; with curl, keep a cookie jar (see [Trying it with curl](#trying-it-with-curl)).
- The token lasts 8 hours with no refresh; after that, sign in again. It's an HS256 JWT checked for signature, issuer, audience, expiry and claim shape on every request.
- Roles: `/api/author/*` is for authors only and `/api/admin/*` for admins only. The wrong role gets 403.
- Author endpoints take the author from the session, never from the URL or body. Another author's ticket returns 404, as if it didn't exist.

### Requests

- Bodies are JSON and need `Content-Type: application/json`; anything else is a 400.
- Bodies are strict: an unknown field (for example `authorId` or `assigneeId`) is a 400.
- Text fields are trimmed before their length is checked.
- **CSRF:** a `POST` or `PATCH` whose `Origin` header names another site is refused with 403. Requests without an `Origin` header (curl, server-to-server) are allowed; the `SameSite=Lax` cookie is the main defence.

### Responses

| Case | Shape |
|---|---|
| Success | `{ "data": … }` (200, or 201 when something is created) |
| Paged list | `{ "data": [ … ], "page": 1, "pageSize": 20, "total": 42 }` |
| Error | `{ "error": { "code": "…", "message": "…", "details": [ … ] } }` (`details` only for field errors) |

Timestamps are ISO 8601 in UTC (`2026-10-31T09:30:00.000Z`). Calendar dates from the dataset are `YYYY-MM-DD`. Money is in whole rupees.

### Errors

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body or query, wrong content type, malformed JSON. Field problems are listed in `details: [{ "path": "subject", "message": "…" }]` |
| 401 | `UNAUTHENTICATED` | No session, an invalid or expired token, or a failed sign-in |
| 403 | `FORBIDDEN` | Wrong role, or a cross-origin mutation |
| 404 | `NOT_FOUND` | Unknown ID, or a ticket that belongs to another author |
| 409 | `CONFLICT` | A unique constraint would be violated |
| 429 | `RATE_LIMITED` | Over a rate limit; the `Retry-After` header gives the seconds to wait |
| 503 | `AI_UNAVAILABLE` | An AI call failed; the message says why and that you can continue manually |
| 500 | `INTERNAL_ERROR` | Unexpected; the message is generic and the details are logged on the server only |

### Rate limits

| Endpoint | Limit |
|---|---|
| `POST /api/auth/login` | 10 failed sign-ins per client IP per 15 minutes. Successful sign-ins aren't counted |
| `POST /api/author/tickets` | 10 new tickets per author per 10 minutes |
| `POST /api/admin/tickets/:id/drafts` and `POST /api/admin/tickets/:id/classification` | 30 per admin per 10 minutes, shared |

A request whose body or fields are invalid (400) isn't counted. The one exception: a ticket whose `bookId` isn't the author's is rejected after it has been counted.

### Values

| Field | Values |
|---|---|
| `status` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `category` | `ROYALTY_PAYMENTS`, `ISBN_METADATA`, `PRINTING_QUALITY`, `DISTRIBUTION_AVAILABILITY`, `BOOK_STATUS_PRODUCTION`, `GENERAL_INQUIRY` |
| `priority` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `classificationStatus` | `PENDING` (AI still running or not yet run), `SUCCEEDED`, `FAILED` |
| `role` | `AUTHOR`, `ADMIN` |

## Endpoints

| Method | Path | Access |
|---|---|---|
| POST | [`/api/auth/login`](#post-apiauthlogin) | public |
| POST | [`/api/auth/logout`](#post-apiauthlogout) | signed in |
| GET | [`/api/auth/me`](#get-apiauthme) | signed in |
| GET | [`/api/author/books`](#get-apiauthorbooks) | author |
| GET | [`/api/author/tickets`](#get-apiauthortickets) | author |
| POST | [`/api/author/tickets`](#post-apiauthortickets) | author |
| GET | [`/api/author/tickets/:id`](#get-apiauthorticketsid) | author |
| GET | [`/api/admin/tickets`](#get-apiadmintickets) | admin |
| GET | [`/api/admin/tickets/:id`](#get-apiadminticketsid) | admin |
| PATCH | [`/api/admin/tickets/:id`](#patch-apiadminticketsid) | admin |
| POST | [`/api/admin/tickets/:id/messages`](#post-apiadminticketsidmessages) | admin |
| POST | [`/api/admin/tickets/:id/notes`](#post-apiadminticketsidnotes) | admin |
| POST | [`/api/admin/tickets/:id/drafts`](#post-apiadminticketsiddrafts) | admin |
| POST | [`/api/admin/tickets/:id/classification`](#post-apiadminticketsidclassification) | admin |

---

### `POST /api/auth/login`

Signs in an author or an admin and sets the session cookie.

**Body**

| Field | Type | Rules |
|---|---|---|
| `email` | string | Required, a valid email. Trimmed and lowercased |
| `password` | string | Required, at most 256 characters |

```json
{ "email": "author@example.com", "password": "••••••••" }
```

**200**: the signed-in user (and the `Set-Cookie` header). `authorId` is null for admins.

```json
{ "data": { "id": "cmabc123", "name": "Asha Rao", "role": "AUTHOR", "authorId": "AUTH001" } }
```

**Errors**
- 400 for a missing or invalid field.
- 401 `"Invalid email or password."`, the same for an unknown email and a wrong password.
- 429 after too many failed attempts from the same IP.

---

### `POST /api/auth/logout`

Clears the session cookie. No body.

**200**

```json
{ "data": { "loggedOut": true } }
```

**Errors:** 401 without a session.

The token is stateless, so a copy made before logout stays valid until it expires (see the README's limitations).

---

### `GET /api/auth/me`

The signed-in user.

**200**: same shape as the login response.

**Errors:** 401 without a valid session, or if the user no longer exists.

---

### `GET /api/author/books`

The signed-in author's books (including ones still in production), with totals and the payout threshold.

**200**

```json
{
  "data": {
    "books": [
      {
        "id": "BK001",
        "title": "The Lantern Road",
        "isbn": "978-00-0XXXX-00-0",
        "genre": "Fiction",
        "publicationDate": "2025-03-10",
        "status": "Published & Live",
        "mrp": 349,
        "authorRoyaltyPerCopy": 40,
        "totalCopiesSold": 220,
        "totalRoyaltyEarned": 8800,
        "royaltyPaid": 6000,
        "royaltyPending": 2800,
        "lastRoyaltyPayoutDate": "2026-08-14",
        "printPartner": "Example Print Co.",
        "availableOn": ["Amazon India", "Flipkart", "BookLeaf Store"]
      }
    ],
    "totals": {
      "bookCount": 1,
      "totalCopiesSold": 220,
      "totalRoyaltyEarned": 8800,
      "royaltyPaid": 6000,
      "royaltyPending": 2800
    },
    "payout": { "thresholdInr": 1000, "belowThreshold": false }
  }
}
```

- `status` is free text, stored exactly as supplied (for example `"In Production - Typesetting"`).
- `publicationDate`, `mrp`, `authorRoyaltyPerCopy`, `lastRoyaltyPayoutDate` and `printPartner` can be null (a book in production, or one never paid out).
- `totals` are plain sums of the books' values.
- `belowThreshold` is true when some royalty is pending but less than `thresholdInr`, so it rolls over to the next quarter.

**Errors:** 401, 403.

---

### `GET /api/author/tickets`

The signed-in author's tickets, most recently updated first.

**200**

```json
{
  "data": [
    {
      "id": "cmtkt001",
      "subject": "Royalty for last quarter not received",
      "description": "I haven't received my royalty for the last quarter yet.",
      "status": "IN_PROGRESS",
      "book": { "id": "BK001", "title": "The Lantern Road" },
      "createdAt": "2026-10-31T09:30:00.000Z",
      "updatedAt": "2026-10-31T10:05:00.000Z"
    }
  ]
}
```

`book` is null for "General / Account Level". Author responses never include category, priority, assignee, AI fields, drafts or internal notes.

**Errors:** 401, 403.

---

### `POST /api/author/tickets`

Raises a support query. The ticket starts as `OPEN`, and AI classification runs in the background after the response.

**Body**

| Field | Type | Rules |
|---|---|---|
| `bookId` | string or null | Required key. One of the author's own book IDs, or `null` for General / Account Level |
| `subject` | string | 3–150 characters |
| `description` | string | 10–5,000 characters |

```json
{ "bookId": "BK001", "subject": "Wrong ISBN on my book page", "description": "The ISBN on the store page belongs to a different book." }
```

**201**: the new ticket, in the same shape as a list item.

**Errors**
- 400 for invalid fields. A `bookId` that isn't the author's (or doesn't exist) gets `details: [{ "path": "bookId", "message": "Choose one of your books, or General / Account Level." }]`.
- 401, 403.
- 429 over the ticket limit. No ticket is created.

The ticket is saved even if AI classification fails or AI is switched off.

---

### `GET /api/author/tickets/:id`

One of the author's tickets with its reply thread, oldest reply first.

**200**

```json
{
  "data": {
    "id": "cmtkt001",
    "subject": "Royalty for last quarter not received",
    "description": "I haven't received my royalty for the last quarter yet.",
    "status": "IN_PROGRESS",
    "book": { "id": "BK001", "title": "The Lantern Road" },
    "createdAt": "2026-10-31T09:30:00.000Z",
    "updatedAt": "2026-10-31T10:05:00.000Z",
    "messages": [
      {
        "id": "cmmsg001",
        "body": "Dear Asha,\n\nThank you for reaching out…",
        "sender": { "name": "Support Lead", "role": "ADMIN" },
        "createdAt": "2026-10-31T10:05:00.000Z"
      }
    ]
  }
}
```

**Errors:** 401, 403, 404 if the ticket doesn't exist or belongs to another author.

The author's ticket page polls this every 5 seconds, so replies and status changes appear without a reload.

---

### `GET /api/admin/tickets`

The support queue, across all authors.

**Query parameters** (all optional)

| Parameter | Values | Default |
|---|---|---|
| `status` | A status. Repeat it for several (`?status=OPEN&status=RESOLVED`) | `OPEN` and `IN_PROGRESS` |
| `category` | A category | all |
| `priority` | A priority | all |
| `unclassified` | `true`: only tickets with no category or priority yet ("Needs triage"); `false`: only classified ones | all |
| `assignee` | `me` or `none` | all |
| `from`, `to` | Created date range, `YYYY-MM-DD`, inclusive (UTC days). `from` must not be after `to` | none |
| `page` | 1 or more | 1 |
| `pageSize` | 1–100 | 20 |

Order: tickets without a priority first (they need triage), then Critical to Low, then oldest first.

**200**

```json
{
  "data": [
    {
      "id": "cmtkt001",
      "subject": "Wrong ISBN on my book page",
      "status": "OPEN",
      "category": "ISBN_METADATA",
      "priority": "HIGH",
      "classificationStatus": "SUCCEEDED",
      "author": { "id": "AUTH001", "name": "Asha Rao" },
      "book": { "id": "BK001", "title": "The Lantern Road" },
      "assignee": null,
      "createdAt": "2026-10-31T09:30:00.000Z",
      "updatedAt": "2026-10-31T09:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

`category` and `priority` are the effective values: the admin's choice if they set one, otherwise the AI's.

**Errors:** 400 for an invalid parameter (unknown parameters are ignored), 401, 403.

---

### `GET /api/admin/tickets/:id`

Everything an admin needs on one ticket: the author, the full book record, the reply thread, internal notes, the AI's suggestion and the latest AI draft.

**200**

```json
{
  "data": {
    "id": "cmtkt001",
    "subject": "Wrong ISBN on my book page",
    "description": "The ISBN on the store page belongs to a different book.",
    "status": "OPEN",
    "category": "ISBN_METADATA",
    "priority": "CRITICAL",
    "aiCategory": "ISBN_METADATA",
    "aiPriority": "HIGH",
    "aiRationale": "An ISBN shown for the wrong book is a metadata error.",
    "classificationStatus": "SUCCEEDED",
    "classifiedAt": "2026-10-31T09:30:03.000Z",
    "createdAt": "2026-10-31T09:30:00.000Z",
    "updatedAt": "2026-10-31T09:32:00.000Z",
    "author": { "id": "AUTH001", "name": "Asha Rao", "email": "author@example.com", "city": "Example City" },
    "book": { "id": "BK001", "title": "The Lantern Road", "…": "every field, as in GET /api/author/books" },
    "assignee": { "id": "cmadm001", "name": "Support Lead" },
    "messages": [],
    "notes": [
      {
        "id": "cmnote01",
        "body": "Checked with production; correction requested.",
        "createdBy": { "id": "cmadm001", "name": "Support Lead" },
        "createdAt": "2026-10-31T09:40:00.000Z"
      }
    ],
    "latestDraft": {
      "id": "cmdrf001",
      "body": "Dear Asha,\n\n…\n\nWarm regards,\nBookLeaf Author Support",
      "commitments": ["Escalate the ISBN correction to the production team within 48 hours"],
      "needsVerification": ["Which ISBN the store page shows"],
      "model": "gemini-3.5-flash-lite",
      "promptVersion": "draft-v2",
      "createdAt": "2026-10-31T09:31:00.000Z",
      "stale": false
    }
  }
}
```

- `aiCategory`, `aiPriority` and `aiRationale` keep the AI's suggestion even after an admin overrides `category` or `priority`. In this example the admin raised the priority to Critical.
- `messages` items have `id`, `body`, `sender` (`id`, `name`, `role`), `aiDraftId` (the draft a reply started from, or null) and `createdAt`.
- `latestDraft` is null until a draft is generated. It's `stale` when a reply was sent after it.
- `commitments` lists what the draft promises BookLeaf will do; `needsVerification` lists facts to check before sending.

**Errors:** 401, 403, 404.

---

### `PATCH /api/admin/tickets/:id`

Changes the status, overrides the category or priority, or assigns the ticket to the caller.

**Body:** at least one of:

| Field | Type | Notes |
|---|---|---|
| `status` | status | Any status |
| `category` | category | Overrides the effective category; `aiCategory` is kept |
| `priority` | priority | Overrides the effective priority; `aiPriority` is kept |
| `assignToMe` | `true` | Assigns the ticket to the calling admin. There's no field for assigning anyone else |

```json
{ "priority": "CRITICAL", "assignToMe": true }
```

**200**: the updated ticket, in the same shape as `GET /api/admin/tickets/:id`.

**Errors:** 400 (empty body, unknown value or unknown field such as `assigneeId`), 401, 403, 404.

AI classification never overwrites a category or priority an admin has set, even if it finishes later.

---

### `POST /api/admin/tickets/:id/messages`

Sends a reply the author will see.

**Body**

| Field | Type | Rules |
|---|---|---|
| `body` | string | 1–5,000 characters |
| `aiDraftId` | string | Optional. The draft the reply started from; it must belong to this ticket |
| `status` | status | Optional. The ticket's status after sending. If omitted, an `OPEN` ticket moves to `IN_PROGRESS` and other statuses stay |

```json
{ "body": "Dear Asha,\n\nThank you for…", "aiDraftId": "cmdrf001", "status": "RESOLVED" }
```

**201**: the stored message and the ticket's new status.

```json
{
  "data": {
    "message": {
      "id": "cmmsg001",
      "body": "Dear Asha,\n\nThank you for…",
      "sender": { "id": "cmadm001", "name": "Support Lead", "role": "ADMIN" },
      "aiDraftId": "cmdrf001",
      "createdAt": "2026-10-31T10:05:00.000Z"
    },
    "status": "RESOLVED"
  }
}
```

**Errors**
- 400 for invalid fields, or `details: [{ "path": "aiDraftId", "message": "That draft isn't for this ticket." }]`.
- 401, 403, 404.

The message and the status change are saved in one transaction. Sending also updates the ticket's `updatedAt`, which moves it to the top of the author's list.

---

### `POST /api/admin/tickets/:id/notes`

Adds an internal note. Notes are never visible to authors.

**Body:** `{ "body": "…" }`, 1–5,000 characters.

**201**

```json
{
  "data": {
    "id": "cmnote01",
    "body": "Checked with production; correction requested.",
    "createdBy": { "id": "cmadm001", "name": "Support Lead" },
    "createdAt": "2026-10-31T09:40:00.000Z"
  }
}
```

**Errors:** 400, 401, 403, 404.

A note doesn't change the ticket's `updatedAt`, so authors see no sign of internal activity.

---

### `POST /api/admin/tickets/:id/drafts`

Generates a new AI draft reply from the ticket, the book's verified facts and the knowledge base, and stores it. No body. Nothing is sent to the author; the admin edits the draft and sends it with `POST …/messages`.

**201**: the draft, in the `latestDraft` shape above.

**Errors**
- 401, 403, 404.
- 429 over the per-admin AI limit.
- 503 `AI_UNAVAILABLE` when the AI call fails. Nothing is stored, and the message says what happened:

  | Cause | Message |
  |---|---|
  | AI not configured | "AI isn't configured here. You can still triage and reply manually." |
  | Timeout | "The AI service took too long to respond. Try again, or continue manually." |
  | Provider rate limit or quota | "The AI service is busy right now. Try again in a minute, or continue manually." |
  | Unusable output | "The AI returned an answer we couldn't use. Try again, or continue manually." |
  | Other provider error | "The AI service is unavailable. Try again later, or continue manually." |

The UI calls this automatically only on the first open of an unanswered Open or In Progress ticket. Afterwards, it's called only when the admin clicks "Draft with AI" or "Regenerate".

---

### `POST /api/admin/tickets/:id/classification`

Runs AI classification again, synchronously, for a ticket that wasn't classified (for example, because the AI was down when it was raised). No body.

**200**: the updated ticket, in the same shape as `GET /api/admin/tickets/:id`.

**Errors**
- 401, 403, 404.
- 429 over the per-admin AI limit.
- 503 `AI_UNAVAILABLE`, with the same messages as for drafts. Category and priority are unchanged, and `classificationStatus` becomes `FAILED`.

The AI's suggestion is always stored in `aiCategory` and `aiPriority`. The effective `category` and `priority` are filled only where they're still empty, so a retry never undoes an admin's choice.

## Trying it with curl

Against `npm run dev` (`http://localhost:3000`). The cookie jar keeps the session between calls.

```bash
# Sign in as an admin
curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"support.lead@bookleaf.example","password":"<admin demo password>"}' \
  http://localhost:3000/api/auth/login

# Unclassified open tickets, 10 per page
curl -s -b cookies.txt 'http://localhost:3000/api/admin/tickets?unclassified=true&pageSize=10'

# Reply and resolve
curl -s -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"body":"Thanks for confirming. We will close this query now.","status":"RESOLVED"}' \
  http://localhost:3000/api/admin/tickets/<ticket id>/messages
```

The demo passwords are in the [README](../README.md#demo-accounts).

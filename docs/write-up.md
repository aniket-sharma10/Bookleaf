# Write-up

My main goal was to get the whole ticket flow working properly before spending time on anything else. So I built the basic path first, without any AI. An author logs in, sees their books and royalty numbers and raises a query. Someone from the support team picks it up from the queue and replies, and the author sees the reply without refreshing the page. Once that worked end to end, I added classification and draft replies on top.

I planned the work in phases, each split into small tasks with clear acceptance criteria ([implementation plan](implementation-plan.md)), and built them one at a time, each with its tests and its own commit. I used Claude Code for much of the implementation and reviewed and tested each change myself.

Before writing code I went through the requirements and decided how to handle the unclear parts. For example: what "overdue" can mean when the data has no payment history, and whether the ₹1,000 minimum payout applies per book or per author (I went with per author). I also wanted the data and access rules right from the start. The seed loads the dataset exactly as given, and a script compares the database with it field by field. Every API route except login checks the user's role in one shared wrapper. Author routes take the author ID only from the session, so an author can't see someone else's tickets by changing an ID in the URL.

With the AI, my biggest worry was a draft promising something BookLeaf never did, like a refund or a payment date. So the model doesn't work out the facts itself. My code calculates the book figures, the next payout deadline, whether pending royalty is below ₹1,000, and the production stage, and the prompt includes only the knowledge base sections that match the ticket's category. The response comes back as JSON that I validate. Along with the reply, the model lists what it's promising and what the admin should check before sending. Nothing goes to the author until an admin sends it. Classification runs after the ticket is saved, so if Gemini is slow or down, authors can still raise tickets and admins can still triage and reply by hand.

I made a few trade-offs on purpose.
- **Polling instead of WebSockets.** Pages refresh every 5 to 15 seconds. It's simple, works on serverless hosting without extra services, and is fast enough for support tickets.
- **JWT in an HttpOnly cookie for sessions.** Simple, but logging out doesn't invalidate a token someone has already copied until it expires after 8 hours.
- **Gemini's free tier with a lite model.** It's fast and costs nothing, but the limits are low and response times spike; a few calls timed out during my testing. Because Google can use free-tier prompts, I keep personal details out of what I send.
- **No vector database.** The whole knowledge base is about 1k tokens, so picking sections by category is enough.

For a production version:
- **Move the AI calls onto a queue,** something like SQS with a Lambda consumer, so failed calls retry on their own instead of waiting for an admin to click retry.
- **Switch to a paid model tier,** for steadier limits and a stronger model for drafts.
- **Keep the knowledge base in the database,** with an editor for the support team. Once it grows, retrieval with pgvector, using past resolved tickets as examples, would make sense.
- **Track how admins edit the drafts,** and use that to improve the prompts.
- **Add the usual platform pieces:** revocable sessions, SSO for staff, email notifications, real attachments and proper monitoring.

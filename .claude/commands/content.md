Turns what Rohit has learned into I M Smrti content. Reads the backlog, helps him pick, scripts it, tracks what got posted.

$ARGUMENTS may contain a lesson number ("4.9"), a count ("give me 3"), a format ("carousel"), or "posted 1.1 2.3" to mark things as published. If empty, show the backlog and recommend.

## STEP 1 — READ STATE

- `docs/learning/CONTENT-TRACKER.md` — the backlog and what's posted
- `docs/learning/LEARNING-LOG.md` — **his own words** on each lesson, the most important input here
- `docs/learning/BOOK/` — the full lesson text for anything he picks
- `docs/CONTENT-STRATEGY.md` — pillars, voice, CTA rotation, compliance
- `docs/CONTENT-DISTRIBUTION.md` — the send-first rules

## STEP 2 — IF HE SAID "posted X.Y"

Mark those lessons `✅ posted` in `CONTENT-TRACKER.md`, move them to the Posted table with today's date, update counters, commit. Confirm in one line. Done — don't script anything new unless he asks.

## STEP 3 — SHOW THE BACKLOG

Short table, newest first, max 10 rows. Then **recommend 1–3** and say why. Recommend on these grounds, in order:

1. **He logged it in his own words** — if `LEARNING-LOG.md` has his phrasing on a lesson, that one is ready and the others aren't. This is the single strongest signal.
2. **It has a live case attached** — something happening in his body or his father's right now
3. **It's sendable** — per `CONTENT-DISTRIBUTION.md`, can he name who sends this to whom? If not, it'll get no reach
4. **Pillar balance** — don't let three posts in a row come from the same pillar

Say plainly when a lesson is NOT ready: if he hasn't logged it, the post will come out sounding like a textbook, which is the exact problem this whole system was built to fix. Better to skip it than force it.

## STEP 4 — SCRIPT IT

Use the format already established in `docs/CONTENT-SCRIPTS-WEEK-01.md`:

```
**Format:** Reel 30-45s / Carousel N slides
**Hook:** [the opening line]
**Say:** [talking points, timed if it's a reel]
**End:** [the handoff — always about THEM, never about him]
**Caption:** [full caption, disclaimer as FIRST line]
**Hashtags:** [5-8]
```

**Non-negotiables — check every single one before handing it over:**
- Disclaimer on-screen at 0:00 AND as the first caption line: `Not a doctor. Health information, not medical advice.` (ASCI Addendum II — see `CONTENT-STRATEGY.md` §12)
- Say what the mechanism IS and what to ASK a doctor. Never what to DO.
- No dose, no diagnosis, no brand endorsement, no "stop your medicine"
- Ends on the handoff — if the post is about him at the end, it's a personal-brand post and belongs on his other channel
- Name the sender and the recipient. "Send this to ___" — if you can't fill that blank, the post has no distribution
- **Use his logged phrasing wherever it exists.** His words beat your words every time. If he wrote "muscle grows when you sleep, not when you lift" — use that, don't improve it.

## STEP 5 — CTA DISCIPLINE

Check the recent Posted rows. Across any 10 posts the split must hold:
- 5 no CTA at all
- 3 engagement ("save this", "send this to ___")
- 1–2 soft app mention
- 0–1 direct download

If the last few posts have drifted promotional, say so and write this one with no CTA.

## STEP 6 — UPDATE AND COMMIT

Mark scripted lessons `🎬 filmed` in `CONTENT-TRACKER.md`. Commit:
```
git add docs/learning/ && git commit -m "Content: scripted lessons X.Y"
```

## THE STANDING RULE

**Not every lesson becomes a post.** The backlog is a library, not a debt. If the honest answer is "nothing here is ready to post this week," say that. Posting a lesson he hasn't absorbed produces exactly the fake-sounding content he rejected the topic bank for.

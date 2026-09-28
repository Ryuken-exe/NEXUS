# Judging design

## Assignment

Manual batch mode considers every selected judge/project pair. Automatic mode considers the selected pool, sorts eligible judges by assigned count, then by stable judge ID, and allocates up to the requested number of distinct judges per project. Active conflicts of interest are excluded in both modes. If a conflict leaves an auto-assigned project below its requested panel size, the response identifies the project and shortage; organizers also receive an audit entry for blocked and reassigned pairs. Database uniqueness prevents duplicate judge/project rows. The load balancer is deterministic and conflict-aware, but is not a preference optimizer.

## Rubric and total

Criterion weights must be non-negative and sum to 100. Each input score must be finite and fall between zero and that criterion's configured maximum. For score $s_i$, maximum $m_i$, and percentage weight $w_i$, the total is:

$$\mathrm{total}=\sum_i \frac{s_i}{m_i} w_i$$

This keeps criteria on different point scales comparable while retaining a 0–100 total. Rubrics can be replaced by an event manager; changing a rubric after scoring will affect future submissions, so organizers should freeze rubrics before assignment.

## Normalization

For every judge, calculate the mean and sample standard deviation of that judge's submitted totals. Convert each score $x$ to:

$$z=\frac{x-\bar{x}}{s}$$

For one score or zero variance, the implementation returns $z=0$ rather than divide by zero. Project normalized results are the mean of its assigned judges' z-scores. This adjusts systematic scale differences, but it cannot remove bias or fix sparse/inconsistent reviews. The report at `/normalization-proof` uses the exact seeded fixture values and production function. Results API chooses raw by default and normalized when sent `x-score-view: normalized`.

## Calibration feedback

After each score submission, compare the judge's running average against the pooled running average of other judges who have each scored at least two projects. A judge also needs at least two scores before receiving a signal. Differences within one point on the 0–100 weighted-total scale are reported as in line; otherwise the signal is higher or lower. The judge endpoint returns only that judge's direction, never the underlying averages. Organizers and admins can see directional patterns for their event. The comparison is recomputed from current scores after every submission.

## Conflict declarations and edit history

Judges can declare a conflict with a team or participant before scoring starts; organizers/admins can pre-set or override declarations. An active conflict prevents assignment to any project from that team or containing that participant in manual and automatic batches. Declarations, overrides, blocked pairs, and reassignments are written to the existing event `AuditLog`. Score edits append a `score.edited` audit entry containing the prior and new totals, rubric values, feedback, changed criteria, timestamp, judge, and optional reason. The application has no update/delete path for audit entries, matching the existing T3 audit convention. The admin score-history view filters these same entries by judge or project rather than maintaining a second history store.

## Deterministic ranking

Final rank is based on the mean normalized z-score. The raw/normalized selector changes the displayed score, not the ranking basis. For identical normalized scores, the order is: higher average score on the highest-weighted rubric criterion (criterion ties use name then ID), more distinct judges, earlier submission timestamp, then stable project ID if all specified measures are identical. Results identify the tie-break level applied to each row ordered within a normalized tie. This removes arbitrary ordering and makes repeated calculations reproducible.

These controls support the Judging Integrity criterion: disclose relationships before scoring, reduce hidden assignment bias, give judges restrained feedback, preserve score changes for review, and make final rankings explainable.

## Voting and visibility

Community votes are one per participant account and one per hashed source IP per event, enforced with PostgreSQL unique indexes. Voting also checks the event's enabled flag, start time, publication state, and server-side end time. This is stricter on shared IPs than account-only voting and is intentionally disclosed. Results remain hidden until both judging and voting have ended and an organizer publishes them. Admin/organizer result access is available for operational review.
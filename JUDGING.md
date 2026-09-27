# Judging design

## Assignment

Manual batch mode assigns every chosen judge to every chosen project. Automatic mode considers the selected pool only, sorts available judges by assigned count, then by stable judge ID, and allocates up to the requested number of distinct judges per project. The stable tie-break makes repeated identical batches understandable and reproducible. Database uniqueness prevents duplicate judge/project rows. This is a transparent load-balancing heuristic, not a preference- or conflict-aware optimizer.

## Rubric and total

Criterion weights must be non-negative and sum to 100. Each input score must be finite and fall between zero and that criterion's configured maximum. For score $s_i$, maximum $m_i$, and percentage weight $w_i$, the total is:

$$\mathrm{total}=\sum_i \frac{s_i}{m_i} w_i$$

This keeps criteria on different point scales comparable while retaining a 0–100 total. Rubrics can be replaced by an event manager; changing a rubric after scoring will affect future submissions, so organizers should freeze rubrics before assignment.

## Normalization

For every judge, calculate the mean and sample standard deviation of that judge's submitted totals. Convert each score $x$ to:

$$z=\frac{x-\bar{x}}{s}$$

For one score or zero variance, the implementation returns $z=0$ rather than divide by zero. Project normalized results are the mean of its assigned judges' z-scores. This adjusts systematic scale differences, but it cannot remove bias or fix sparse/inconsistent reviews. The report at `/normalization-proof` uses the exact seeded fixture values and production function. Results API chooses raw by default and normalized when sent `x-score-view: normalized`.

## Voting and visibility

Community votes are one per participant account and one per hashed source IP per event, enforced with PostgreSQL unique indexes. Voting also checks the event's enabled flag, start time, publication state, and server-side end time. This is stricter on shared IPs than account-only voting and is intentionally disclosed. Results remain hidden until both judging and voting have ended and an organizer publishes them. Admin/organizer result access is available for operational review.
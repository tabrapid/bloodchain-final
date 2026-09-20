# Reviewer packs

Four documents, one per reviewer, each holding the questions that person — and
only that person — can answer.

## Why these exist separately from the decision register

`docs/clinical-operational-decisions.md` is an inventory of what the software
does today: thirty-one behaviours, where each is encoded, and who has to sign
it off. It is written for an engineer checking what is true.

These packs are written for the reviewer. Each entry states what the system
does now, asks one question in a form that can be answered without reading any
code, says what happens to the software depending on the answer, and gives the
exact shape the answer has to take so it can be applied without another round
trip. A question whose answer would not change the software is not in here.

## The four packs

| Pack | Reviewer | Covers |
| --- | --- | --- |
| [`clinical-review.md`](clinical-review.md) | Transfusion medicine specialist | Donor eligibility, deferral, recovery intervals, compatibility, component shelf life |
| [`laboratory-review.md`](laboratory-review.md) | Blood-bank laboratory specialist | Donation screening, release requirements, blood grouping, reference ranges |
| [`blood-center-operations-review.md`](blood-center-operations-review.md) | Blood-centre / hospital operator | Stock thresholds, cold chain, recall, staffing, paper fallback |
| [`legal-privacy-review.md`](legal-privacy-review.md) | Legal and privacy counsel | Identity, consent, retention, location data, regulatory approval |

## How to answer

Write the answer directly into the pack, under the entry, in the **Answer**
block that each one carries. Fill the signature line. Commit the file.

A pack entry is only closed when it carries a name, a date and an answer in the
stated format. "Looks reasonable" is not an answer and does not close anything:
the decision register's `VALIDATED` status requires evidence in this
repository, and a signed entry here is that evidence.

## What is NOT in these packs

No proposed clinical values. Not one. Where a number, a threshold, a test list
or an interval would belong, the entry says what the software will do with it
and stops. This repository has no opinion about any of them and is not entitled
to one — offering a plausible default alongside the question is how a
development placeholder becomes a clinical rule by inattention.

Where a value is currently in the code as a development default, the entry says
so explicitly and says what refuses to run without a real one.

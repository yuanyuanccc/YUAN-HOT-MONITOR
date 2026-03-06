---
name: "hotspot-reviewer"
description: "Produce manual review decisions for analyzed hotspots. Invoke when user needs approval/rejection notes and audit-ready confirmation records."
---

# Hotspot Reviewer

## Purpose

Use this skill to standardize manual confirmation results after AI analysis, making records reusable for audits and retrospectives.

## When To Invoke

- User asks for human confirmation wording
- AI analysis is done and needs approve/reject decision text
- Team needs consistent review notes for operations logs

## Input Template

- Analysis title
- Summary and score
- Risk level
- Reviewer stance (approve/reject)

## Output Template

- Decision status (approved/rejected)
- Review note
- Risk handling recommendation
- Follow-up monitoring point

## Quality Rules

- Note must explain rationale in one to two sentences
- Recommendation must match risk level
- Monitoring point should be measurable

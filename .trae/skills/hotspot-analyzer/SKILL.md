---
name: "hotspot-analyzer"
description: "Generate structured hotspot analysis from trend samples. Invoke when user needs rapid topic scoring, risk grading, and response suggestions."
---

# Hotspot Analyzer

## Purpose

Use this skill to transform raw trend text into a structured hotspot conclusion that can be quickly reviewed by humans.

## When To Invoke

- User asks to identify whether a topic is becoming hot
- User provides social/media text samples and wants a risk score
- User needs a one-shot analysis before manual confirmation

## Input Template

- Keyword
- Time range
- Sample texts, one per line

## Output Template

- Hotspot title
- Summary
- Score (0-100)
- Risk level (low/medium/high)
- Recommended actions (3 items)

## Quality Rules

- Keep summary concise and decision-friendly
- Keep risk level aligned with score
- Actions must be practical and executable

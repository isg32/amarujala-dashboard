# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository currently contains no application code — only `report.md`, a Functional Requirement Document (FRD) for a "Reader Management Dashboard" (a system for managing newspaper reader subscriptions, billing, delivery attendance, and payments across a Zone → Unit → City → Center → POC → Reader hierarchy).

There is no build system, package manifest, or test suite to document yet. Once a project is scaffolded here, this file should be updated with real commands (build/lint/test) and an architecture overview.

## Working from the spec

Treat `report.md` as the source of truth for product requirements when implementing features — it defines the organizational hierarchy, data model expectations (reader profile fields, billing/payment logic, attendance tracking), and the two user roles (Administrator vs. AU POC) with their respective permissions. Read the relevant section of `report.md` before implementing a feature rather than assuming behavior.

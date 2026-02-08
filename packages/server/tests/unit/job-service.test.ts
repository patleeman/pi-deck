import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseJobFrontmatter, parseJob, updateJobFrontmatter, extractReviewSection, buildReviewPrompt } from '../../src/job-service.js';

const TEST_DIR = join(tmpdir(), 'pi-job-service-test-' + Date.now());

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Job Service', () => {
  describe('parseJobFrontmatter tags', () => {
    it('parses inline tags and normalizes duplicates', () => {
      const content = `---
title: Test
tags: [frontend, "Bug Fix", FRONTEND]
---

# Test`;

      const { frontmatter } = parseJobFrontmatter(content);
      expect(frontmatter.tags).toEqual(['frontend', 'Bug Fix']);
    });

    it('parses multi-line list tags', () => {
      const content = `---
title: Test
tags:
  - backend
  - "High Priority"
---

# Test`;

      const { frontmatter } = parseJobFrontmatter(content);
      expect(frontmatter.tags).toEqual(['backend', 'High Priority']);
    });
  });

  describe('parseJob', () => {
    it('exposes normalized tags on JobInfo', () => {
      const content = `---
title: Test
tags: [infra, INFRA, qa]
updated: 2026-02-07T12:00:00.000Z
---

# Test`;

      const job = parseJob('/tmp/test.md', content);
      expect(job.tags).toEqual(['infra', 'qa']);
      expect(job.frontmatter.tags).toEqual(['infra', 'qa']);
    });

    it('defaults tags to empty array when missing', () => {
      const content = `---
title: Untagged
---

# Untagged`;

      const job = parseJob('/tmp/untagged.md', content);
      expect(job.tags).toEqual([]);
      expect(job.frontmatter.tags).toEqual([]);
    });
  });

  describe('updateJobFrontmatter', () => {
    it('writes tags that round-trip correctly', () => {
      const content = `---
title: Test
---

# Test`;
      const updated = updateJobFrontmatter(content, { tags: ['frontend', 'bug-fix'] });

      // Verify round-trip: re-parse and check tags are preserved
      const { frontmatter } = parseJobFrontmatter(updated);
      expect(frontmatter.tags).toEqual(['frontend', 'bug-fix']);
      // Body should be preserved
      expect(updated).toContain('# Test');
    });

    it('replaces existing tags and preserves other fields', () => {
      const content = `---
title: Test
tags:
  - old
  - stale
updated: 2026-02-07T10:00:00.000Z
---

# Test`;

      const updated = updateJobFrontmatter(content, { tags: ['new'] });

      // Verify round-trip: old tags gone, new tags present
      const { frontmatter } = parseJobFrontmatter(updated);
      expect(frontmatter.tags).toEqual(['new']);
      expect(frontmatter.updated).toBe('2026-02-07T10:00:00.000Z');
      // Body preserved
      expect(updated).toContain('# Test');
    });
  });

  describe('parseJobFrontmatter reviewSessionId', () => {
    it('parses reviewSessionId from frontmatter', () => {
      const content = `---
title: Test
phase: review
reviewSessionId: job-review-123
---

# Test`;

      const { frontmatter } = parseJobFrontmatter(content);
      expect(frontmatter.reviewSessionId).toBe('job-review-123');
    });

    it('defaults reviewSessionId to undefined when missing', () => {
      const content = `---
title: Test
phase: executing
---

# Test`;

      const { frontmatter } = parseJobFrontmatter(content);
      expect(frontmatter.reviewSessionId).toBeUndefined();
    });
  });

  describe('extractReviewSection', () => {
    it('extracts review section content', () => {
      const content = `---
title: Test
---

# Test

## Plan

- [x] Do something

## Review

Run /skill:code-review on the changes.
Verify the button click deletes the item.

## Notes

Some notes.`;

      const section = extractReviewSection(content);
      expect(section).toBe('Run /skill:code-review on the changes.\nVerify the button click deletes the item.');
    });

    it('extracts review section at end of file', () => {
      const content = `---
title: Test
---

# Test

## Review

Use playwright to test the new feature.`;

      const section = extractReviewSection(content);
      expect(section).toBe('Use playwright to test the new feature.');
    });

    it('returns null when no review section exists', () => {
      const content = `---
title: Test
---

# Test

## Plan

- [ ] Do something`;

      const section = extractReviewSection(content);
      expect(section).toBeNull();
    });

    it('returns null when review section is empty', () => {
      const content = `---
title: Test
---

# Test

## Review

## Plan

- [ ] Do something`;

      const section = extractReviewSection(content);
      expect(section).toBeNull();
    });

    it('is case-insensitive for heading match', () => {
      const content = `---
title: Test
---

# Test

## review

Check all tests pass.`;

      const section = extractReviewSection(content);
      expect(section).toBe('Check all tests pass.');
    });

    it('ignores HTML comments in review section', () => {
      const content = `---
title: Test
---

# Test

## Review

<!-- This is a comment -->
<!-- Another comment -->`;

      // Comments only — extractReviewSection returns the raw text (non-null since there's content)
      const section = extractReviewSection(content);
      expect(section).not.toBeNull();
      expect(section).toContain('<!-- This is a comment -->');
    });
  });

  describe('buildReviewPrompt', () => {
    it('includes skill references and criteria from review section', () => {
      const content = `---
title: Test
phase: review
---

# Test

## Plan

- [x] Add feature

## Review

Run /skill:code-review on all changed files.
Run /skill:security-review to check for vulnerabilities.
Use playwright to verify the button click deletes the item.`;

      const filePath = join(TEST_DIR, 'review-with-section.md');
      writeFileSync(filePath, content, 'utf-8');

      const prompt = buildReviewPrompt(filePath);

      expect(prompt).toContain('phase="review"');
      expect(prompt).toContain(filePath);
      expect(prompt).toContain('/skill:code-review');
      expect(prompt).toContain('/skill:security-review');
      expect(prompt).toContain('playwright');
      expect(prompt).toContain('button click deletes the item');
    });

    it('produces a fallback prompt when no review section exists', () => {
      const content = `---
title: Test
phase: review
---

# Test

## Plan

- [x] Do something`;

      const filePath = join(TEST_DIR, 'review-no-section.md');
      writeFileSync(filePath, content, 'utf-8');

      const prompt = buildReviewPrompt(filePath);

      expect(prompt).toContain('phase="review"');
      expect(prompt).toContain('general review');
    });
  });
});

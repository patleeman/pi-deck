import { describe, it, expect } from 'vitest';
import { parseJobFrontmatter, parseJob, updateJobFrontmatter } from '../../src/job-service.js';

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
    it('writes tags as inline YAML array', () => {
      const content = `---
title: Test
---

# Test`;
      const updated = updateJobFrontmatter(content, { tags: ['frontend', 'bug-fix'] });

      expect(updated).toContain('tags: [frontend, bug-fix]');
    });

    it('replaces existing multi-line tags list', () => {
      const content = `---
title: Test
tags:
  - old
  - stale
updated: 2026-02-07T10:00:00.000Z
---

# Test`;

      const updated = updateJobFrontmatter(content, { tags: ['new'] });

      expect(updated).toContain('tags: [new]');
      expect(updated).not.toContain('- old');
      expect(updated).not.toContain('- stale');
      expect(updated).toContain('updated: 2026-02-07T10:00:00.000Z');
    });
  });
});

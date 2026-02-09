import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadJobConfig,
  resolveLocationPath,
  getJobDirectories,
  createJob,
  discoverJobs,
  type JobConfig,
} from '../../src/job-service.js';

const TEST_DIR = join(tmpdir(), 'pi-job-config-test-' + Date.now());
const WORKSPACE_DIR = join(TEST_DIR, 'workspace');

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(WORKSPACE_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  // Clean up any config file before each test
  const configPath = join(WORKSPACE_DIR, '.pi', 'jobs.json');
  rmSync(configPath, { force: true });
});

describe('Job Configuration', () => {
  describe('loadJobConfig', () => {
    it('returns null when config file does not exist (backward compatibility)', () => {
      const config = loadJobConfig(WORKSPACE_DIR);
      expect(config).toBeNull();
    });

    it('parses valid configuration file', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      const config: JobConfig = {
        locations: ['~/.pi/agent/jobs/test', '.pi/jobs'],
        defaultLocation: '~/.pi/agent/jobs/test',
      };
      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify(config, null, 2), 'utf-8');

      const loaded = loadJobConfig(WORKSPACE_DIR);
      expect(loaded).toEqual(config);
    });

    it('throws error for invalid JSON', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), 'invalid json {', 'utf-8');

      expect(() => loadJobConfig(WORKSPACE_DIR)).toThrow('Invalid JSON');
    });

    it('throws error when locations array is missing', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({ defaultLocation: '/jobs' }), 'utf-8');

      expect(() => loadJobConfig(WORKSPACE_DIR)).toThrow('must have a non-empty "locations" array');
    });

    it('throws error when locations array is empty', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({ locations: [] }), 'utf-8');

      expect(() => loadJobConfig(WORKSPACE_DIR)).toThrow('must have a non-empty "locations" array');
    });

    it('throws error when location is not a string', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({ locations: [123] }), 'utf-8');

      expect(() => loadJobConfig(WORKSPACE_DIR)).toThrow('Location must be a string');
    });

    it('throws error when defaultLocation is not a string', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: ['/jobs'],
        defaultLocation: 456,
      }), 'utf-8');

      expect(() => loadJobConfig(WORKSPACE_DIR)).toThrow('defaultLocation must be a string');
    });

    it('allows configuration without defaultLocation', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: ['/jobs', './local-jobs'],
      }), 'utf-8');

      const loaded = loadJobConfig(WORKSPACE_DIR);
      expect(loaded?.defaultLocation).toBeUndefined();
      expect(loaded?.locations).toEqual(['/jobs', './local-jobs']);
    });
  });

  describe('resolveLocationPath', () => {
    it('resolves absolute paths unchanged', () => {
      const absolutePath = '/Users/test/jobs';
      const resolved = resolveLocationPath(absolutePath, WORKSPACE_DIR);
      expect(resolved).toBe(absolutePath);
    });

    it('expands ~ to home directory', () => {
      const homePath = '~/jobs';
      const resolved = resolveLocationPath(homePath, WORKSPACE_DIR);
      expect(resolved).toMatch(/^\/.*\/jobs$/); // Should end with /jobs
    });

    it('expands ~/path to home directory', () => {
      const homePath = '~/.pi/jobs';
      const resolved = resolveLocationPath(homePath, WORKSPACE_DIR);
      expect(resolved).toMatch(/^\/.*\/\.pi\/jobs$/);
    });

    it('resolves relative paths from workspace root', () => {
      const relativePath = './local-jobs';
      const resolved = resolveLocationPath(relativePath, WORKSPACE_DIR);
      expect(resolved).toBe(join(WORKSPACE_DIR, 'local-jobs'));
    });

    it('resolves .pi/jobs relative path', () => {
      const relativePath = '.pi/jobs';
      const resolved = resolveLocationPath(relativePath, WORKSPACE_DIR);
      expect(resolved).toBe(join(WORKSPACE_DIR, '.pi', 'jobs'));
    });

    it('throws error when location is not a string', () => {
      expect(() => resolveLocationPath(123 as any, WORKSPACE_DIR)).toThrow('must be a string');
      expect(() => resolveLocationPath(null as any, WORKSPACE_DIR)).toThrow('must be a string');
      expect(() => resolveLocationPath(undefined as any, WORKSPACE_DIR)).toThrow('must be a string');
    });
  });

  describe('getJobDirectories', () => {
    it('returns default locations when no config exists', () => {
      const dirs = getJobDirectories(WORKSPACE_DIR);
      expect(dirs).toHaveLength(2);
      expect(dirs[0]).toContain('.pi/agent/jobs');
      expect(dirs[1]).toBe(join(WORKSPACE_DIR, '.pi', 'jobs'));
    });

    it('returns configured locations when config exists', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: ['/test/jobs', './local-jobs'],
      }), 'utf-8');

      const dirs = getJobDirectories(WORKSPACE_DIR);
      expect(dirs).toHaveLength(2);
      expect(dirs[0]).toBe('/test/jobs');
      expect(dirs[1]).toBe(join(WORKSPACE_DIR, 'local-jobs'));
    });

    it('resolves and expands paths from config', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: ['~/.pi/jobs', '.pi/jobs'],
      }), 'utf-8');

      const dirs = getJobDirectories(WORKSPACE_DIR);
      expect(dirs).toHaveLength(2);
      expect(dirs[0]).toMatch(/^\/.*\/\.pi\/jobs$/);
      expect(dirs[1]).toBe(join(WORKSPACE_DIR, '.pi', 'jobs'));
    });

    it('creates missing directories when creating a job', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      const customJobsDir = join(WORKSPACE_DIR, 'custom-jobs');
      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: [customJobsDir],
        defaultLocation: customJobsDir,
      }), 'utf-8');

      const result = createJob(WORKSPACE_DIR, 'Test Job', 'Test description');
      expect(result.path).toContain(customJobsDir);
      expect(existsSync(customJobsDir)).toBe(true);
    });

    it('falls back to default behavior on config error', () => {
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });

      // Write invalid JSON
      writeFileSync(join(configPath, 'jobs.json'), '{ invalid }', 'utf-8');

      // Should still return default locations
      const dirs = getJobDirectories(WORKSPACE_DIR);
      expect(dirs).toHaveLength(2);
      expect(dirs[0]).toContain('.pi/agent/jobs');
      expect(dirs[1]).toBe(join(WORKSPACE_DIR, '.pi', 'jobs'));
    });
  });

  describe('Integration: multiple job locations', () => {
    it('discovers jobs from all configured locations', () => {
      // Create multiple job directories
      const jobsDir1 = join(TEST_DIR, 'jobs-1');
      const jobsDir2 = join(WORKSPACE_DIR, 'jobs-2');
      mkdirSync(jobsDir1, { recursive: true });
      mkdirSync(jobsDir2, { recursive: true });

      // Write config
      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });
      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: [jobsDir1, jobsDir2],
      }), 'utf-8');

      // Create jobs in each location
      const job1Path = join(jobsDir1, '20260209-job1.md');
      writeFileSync(job1Path, `---
title: "Job 1"
phase: backlog
created: 2026-02-09T00:00:00.000Z
updated: 2026-02-09T00:00:00.000Z
---

# Job 1
`, 'utf-8');

      const job2Path = join(jobsDir2, '20260209-job2.md');
      writeFileSync(job2Path, `---
title: "Job 2"
phase: executing
created: 2026-02-09T00:00:00.000Z
updated: 2026-02-09T00:00:00.000Z
---

# Job 2
`, 'utf-8');

      // Discover jobs
      const jobs = discoverJobs(WORKSPACE_DIR);
      expect(jobs).toHaveLength(2);
      expect(jobs.find(j => j.title === 'Job 1')).toBeDefined();
      expect(jobs.find(j => j.title === 'Job 2')).toBeDefined();
    });

    it('creates job in defaultLocation when specified', () => {
      const jobsDir1 = join(TEST_DIR, 'jobs-1');
      const jobsDir2 = join(WORKSPACE_DIR, 'jobs-2');
      mkdirSync(jobsDir1, { recursive: true });
      mkdirSync(jobsDir2, { recursive: true });

      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });
      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: [jobsDir1, jobsDir2],
        defaultLocation: jobsDir2,
      }), 'utf-8');

      const result = createJob(WORKSPACE_DIR, 'Test Job', 'Test description');
      expect(result.path).toContain(jobsDir2);
      expect(result.path).not.toContain(jobsDir1);
    });

    it('creates job in first location when defaultLocation is not specified', () => {
      const jobsDir1 = join(TEST_DIR, 'jobs-1');
      const jobsDir2 = join(WORKSPACE_DIR, 'jobs-2');
      mkdirSync(jobsDir1, { recursive: true });
      mkdirSync(jobsDir2, { recursive: true });

      const configPath = join(WORKSPACE_DIR, '.pi');
      mkdirSync(configPath, { recursive: true });
      writeFileSync(join(configPath, 'jobs.json'), JSON.stringify({
        locations: [jobsDir1, jobsDir2],
      }), 'utf-8');

      const result = createJob(WORKSPACE_DIR, 'Test Job', 'Test description');
      expect(result.path).toContain(jobsDir1);
      expect(result.path).not.toContain(jobsDir2);
    });
  });
});

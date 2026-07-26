---
name: vitest-testing
description: >-
  Testing with Vitest (or Jest) for TypeScript applications. Use when writing unit tests, integration tests, mocking, coverage, mutation testing (Stryker), or TDD workflows in Node.js/TypeScript.
  
  Українською: тестування Vitest, Jest, написати тест, юніт тест, інтеграційний тест, мок, покриття, мутаційне тестування, TDD, vi.fn, vi.mock, describe, it.

triggers:
  - Vitest
  - Jest
  - test
  - spec
  - TDD
  - assertion
  - coverage
  - mock
  - vi.fn
  - vi.mock
  - Stryker
---

# Vitest Testing

## When to Apply

- Creating new unit or integration tests
- Modifying existing tests
- Debugging test failures
- Setting up coverage or mutation testing
- TDD workflow

## Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatePostUseCase } from '@/use-cases/create-post/create-post.usecase';

describe('CreatePostUseCase', () => {
  let useCase: CreatePostUseCase;
  let mockRepo: {
    save: ReturnType<typeof vi.fn>;
    existsBySlug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      existsBySlug: vi.fn().mockResolvedValue(false),
    };
    useCase = new CreatePostUseCase(mockRepo as any);
  });

  it('creates a post and saves it', async () => {
    const result = await useCase.execute({
      title: 'Test Post',
      body: 'Content',
    });

    expect(result.title).toBe('Test Post');
    expect(mockRepo.save).toHaveBeenCalledOnce();
  });

  it('throws ConflictError if slug exists', async () => {
    mockRepo.existsBySlug.mockResolvedValue(true);

    await expect(useCase.execute({ title: 'Test', body: 'Content' })).rejects.toThrow(ConflictError);
  });
});
```

## Mocking

```typescript
// Mock entire module
vi.mock('../services/email.service');

// Spy on method
const spy = vi.spyOn(emailService, 'send').mockResolvedValue(undefined);
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
```

## HTTP Integration Tests

```typescript
import supertest from 'supertest';
import { app } from '@/app';

it('POST /posts returns 201', async () => {
  const response = await supertest(app).post('/posts').set('Authorization', `Bearer ${testToken}`).send({ title: 'New Post', body: 'Content' });

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    id: expect.any(String),
    title: 'New Post',
  });
});

it('POST /posts returns 422 for invalid input', async () => {
  const response = await supertest(app).post('/posts').set('Authorization', `Bearer ${testToken}`).send({ title: '' });

  expect(response.status).toBe(422);
  expect(response.body.fields).toHaveProperty('title');
});
```

## Assertions Reference

| Pattern                                       | Use                            |
| --------------------------------------------- | ------------------------------ |
| `expect(x).toBe(y)`                           | Strict equality (`===`)        |
| `expect(x).toEqual(y)`                        | Deep equality                  |
| `expect(x).toMatchObject(partial)`            | Partial object match           |
| `expect(fn).toHaveBeenCalledOnce()`           | Mock called exactly once       |
| `expect(fn).toHaveBeenCalledWith(...)`        | Mock called with specific args |
| `expect(promise).rejects.toThrow(ErrorClass)` | Async error assertion          |

## Models Testing Policy

**DO NOT** create unit tests for basic ORM entity CRUD or simple relationships.

**DO test**: UseCases, Services, complex validators, guards, event handlers.

## Database Testing

- Use test containers for integration tests, or wrap each test in a transaction and roll back
- Never share DB state between tests — always reset in `beforeEach`

## Running Tests

```bash
docker compose exec app npx vitest run
docker compose exec app npx vitest run --coverage
docker compose exec app npx vitest run test/unit/create-post.spec.ts
docker compose exec app npx vitest watch
docker compose exec app npx stryker run
```

Minimum mutation score: **80%** for covered code.

## Common Pitfalls

- Forgetting to `await` async assertions (`rejects.toThrow`)
- Sharing mock state between tests — always reset in `beforeEach`
- Testing implementation instead of behavior
- Brittle assertions: prefer `toMatchObject` over exact `toEqual` for API responses

## Related Skills

- **test-master** — Testing strategies and planning

## Local Override

If `.claude/skills-local/vitest-testing/SKILL.md` exists, read it first; treat its instructions as overriding conflicting guidance above. This override file carries no frontmatter — skill discovery does not scan `.claude/skills-local/**`, so a `name:`/`description:`/`triggers:` block there would be inert and only risks a name collision if ever promoted to `.claude/skills/`. The override covers this `SKILL.md` only — bundled resources are never auto-shadowed; to replace one, place your copy under `.claude/skills-local/vitest-testing/` and re-point to it from your local `SKILL.md`.

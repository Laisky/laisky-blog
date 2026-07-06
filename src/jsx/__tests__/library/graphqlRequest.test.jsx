// @vitest-environment node

import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  graphqlMutation,
  graphqlQuery,
  isGraphqlJsonContentType,
  isJsonExecutionResult,
} from '../../library/base';

vi.mock('@laisky/js-utils', () => ({
  default: {
    KvGet: vi.fn(),
    KvSet: vi.fn(),
    KvDel: vi.fn(),
  },
}));

describe('graphql request helpers', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('detects GraphQL JSON content types with parameters', () => {
    expect(isGraphqlJsonContentType('application/json; charset=utf-8')).toBe(true);
    expect(isGraphqlJsonContentType('application/graphql-response+json')).toBe(true);
    expect(isGraphqlJsonContentType('text/plain')).toBe(false);
  });

  test('detects JSON execution result bodies', () => {
    expect(isJsonExecutionResult('{"data":{"BlogPosts":[]}}')).toBe(true);
    expect(isJsonExecutionResult('[{"data":{"BlogPosts":[]}}]')).toBe(true);
    expect(isJsonExecutionResult('"not an execution result"')).toBe(false);
    expect(isJsonExecutionResult('not json')).toBe(false);
  });

  test('parses query responses when GraphQL JSON is returned as text/plain', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        BlogPosts: [{ name: 'chatgpt' }],
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    }));

    const result = await graphqlQuery('query { BlogPosts { name } }');

    expect(result).toEqual({
      BlogPosts: [{ name: 'chatgpt' }],
    });
  });

  test('parses mutation responses when GraphQL JSON is returned without a content type', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        CreateComment: { id: 'comment-1' },
      },
    }), {
      status: 200,
    }));

    const result = await graphqlMutation('mutation { CreateComment { id } }');

    expect(result).toEqual({
      CreateComment: { id: 'comment-1' },
    });
  });
});

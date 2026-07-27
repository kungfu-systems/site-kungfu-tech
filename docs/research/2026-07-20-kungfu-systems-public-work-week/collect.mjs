#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
const organization = process.env.KUNGFU_RESEARCH_ORG ?? "kungfu-systems";
const start = process.env.KUNGFU_RESEARCH_START ?? "2026-07-19T16:00:00Z";
const end = process.env.KUNGFU_RESEARCH_END ?? new Date().toISOString();

const startTime = Date.parse(start);
const endTime = Date.parse(end);
if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
  throw new Error(`invalid collection window: ${start}..${end}`);
}

function graphql(query, variables = {}) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    if (value !== null && value !== undefined && value !== "") {
      args.push("-f", `${name}=${value}`);
    }
  }
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return JSON.parse(
        execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
      );
    } catch (error) {
      if (attempt === 5) {
        throw error;
      }
      const delayMilliseconds = attempt * 1_000;
      console.error(`GitHub GraphQL request failed; retrying in ${delayMilliseconds} ms`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMilliseconds);
    }
  }
  throw new Error("unreachable GraphQL retry state");
}

function utcDaysBetween(from, to) {
  const days = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const last = new Date(to);
  last.setUTCHours(0, 0, 0, 0);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function withinWindow(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= startTime && timestamp <= endTime;
}

function deduplicateByUrl(records) {
  return [...new Map(records.map((record) => [record.url, record])).values()];
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`);
}

const pullRequestQuery = `
  query($searchQuery: String!, $cursor: String) {
    search(query: $searchQuery, type: ISSUE, first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          number
          title
          url
          state
          createdAt
          updatedAt
          mergedAt
          additions
          deletions
          changedFiles
          baseRefName
          headRefName
          author { login }
          mergedBy { login }
          commits { totalCount }
          labels(first: 50) { nodes { name } }
          repository { nameWithOwner url }
        }
      }
    }
  }
`;

const issueQuery = `
  query($searchQuery: String!, $cursor: String) {
    search(query: $searchQuery, type: ISSUE, first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Issue {
          number
          title
          url
          state
          createdAt
          updatedAt
          closedAt
          author { login }
          labels(first: 50) { nodes { name } }
          repository { nameWithOwner url }
        }
      }
    }
  }
`;

function collectSearch(queryDocument, searchQuery, connectionName = "search") {
  const records = [];
  let cursor = null;
  do {
    const response = graphql(queryDocument, { searchQuery, cursor });
    const connection = response.data[connectionName];
    records.push(...connection.nodes.filter(Boolean));
    cursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);
  return records;
}

const pullRequests = [];
const closedIssues = [];
for (const day of utcDaysBetween(startTime, endTime)) {
  pullRequests.push(
    ...collectSearch(
      pullRequestQuery,
      `org:${organization} is:pr is:merged merged:${day}`,
    ),
  );
  closedIssues.push(
    ...collectSearch(
      issueQuery,
      `org:${organization} is:issue is:closed closed:${day}`,
    ),
  );
}

const repositoryQuery = `
  query($organization: String!, $cursor: String) {
    organization(login: $organization) {
      repositories(
        first: 100
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          nameWithOwner
          url
          description
          isArchived
          isFork
          isPrivate
          createdAt
          updatedAt
          pushedAt
          primaryLanguage { name }
          releases(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              name
              tagName
              url
              createdAt
              publishedAt
              isDraft
              isPrerelease
            }
          }
        }
      }
    }
  }
`;

const repositories = [];
let repositoryCursor = null;
do {
  const response = graphql(repositoryQuery, {
    organization,
    cursor: repositoryCursor,
  });
  const connection = response.data.organization.repositories;
  repositories.push(...connection.nodes);
  repositoryCursor = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
} while (repositoryCursor);

const normalizedPullRequests = deduplicateByUrl(pullRequests)
  .filter((pullRequest) => withinWindow(pullRequest.mergedAt))
  .map((pullRequest) => ({
    ...pullRequest,
    author: pullRequest.author?.login ?? null,
    mergedBy: pullRequest.mergedBy?.login ?? null,
    commitCount: pullRequest.commits.totalCount,
    labels: pullRequest.labels.nodes.map((label) => label.name),
    repository: pullRequest.repository.nameWithOwner,
    repositoryUrl: pullRequest.repository.url,
  }))
  .map(({ commits, ...pullRequest }) => pullRequest)
  .sort((left, right) => left.mergedAt.localeCompare(right.mergedAt));

const normalizedIssues = deduplicateByUrl(closedIssues)
  .filter((issue) => withinWindow(issue.closedAt))
  .map((issue) => ({
    ...issue,
    author: issue.author?.login ?? null,
    labels: issue.labels.nodes.map((label) => label.name),
    repository: issue.repository.nameWithOwner,
    repositoryUrl: issue.repository.url,
  }))
  .sort((left, right) => left.closedAt.localeCompare(right.closedAt));

const releases = repositories
  .flatMap((repository) =>
    repository.releases.nodes.map((release) => ({
      ...release,
      repository: repository.nameWithOwner,
      repositoryUrl: repository.url,
    })),
  )
  .filter((release) => withinWindow(release.publishedAt ?? release.createdAt))
  .sort((left, right) =>
    (left.publishedAt ?? left.createdAt).localeCompare(right.publishedAt ?? right.createdAt),
  );

const normalizedRepositories = repositories.map(({ releases: ignored, ...repository }) => ({
  ...repository,
  primaryLanguage: repository.primaryLanguage?.name ?? null,
}));

const shanghaiDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function increment(map, key, values) {
  const current = map.get(key) ?? {
    pullRequests: 0,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    commits: 0,
  };
  current.pullRequests += 1;
  current.additions += values.additions;
  current.deletions += values.deletions;
  current.changedFiles += values.changedFiles;
  current.commits += values.commitCount;
  map.set(key, current);
}

const byRepository = new Map();
const byShanghaiDay = new Map();
const byAuthor = new Map();
for (const pullRequest of normalizedPullRequests) {
  increment(byRepository, pullRequest.repository, pullRequest);
  increment(byShanghaiDay, shanghaiDate.format(new Date(pullRequest.mergedAt)), pullRequest);
  increment(byAuthor, pullRequest.author ?? "unknown", pullRequest);
}

const totals = normalizedPullRequests.reduce(
  (result, pullRequest) => ({
    pullRequests: result.pullRequests + 1,
    additions: result.additions + pullRequest.additions,
    deletions: result.deletions + pullRequest.deletions,
    changedFiles: result.changedFiles + pullRequest.changedFiles,
    commits: result.commits + pullRequest.commitCount,
  }),
  { pullRequests: 0, additions: 0, deletions: 0, changedFiles: 0, commits: 0 },
);

const sortSummary = (map) =>
  [...map.entries()]
    .map(([name, values]) => ({ name, ...values }))
    .sort((left, right) => right.pullRequests - left.pullRequests || left.name.localeCompare(right.name));

const collectedAt = new Date().toISOString();
const metadata = {
  schemaVersion: 1,
  organization,
  window: {
    start,
    end,
    timezone: "Asia/Shanghai",
    humanReadable: "2026-07-20 00:00 CST through collection time",
  },
  collectedAt,
  source: "GitHub public GraphQL API through the authenticated gh client",
  inclusion: {
    pullRequests: "Merged pull requests whose mergedAt falls inside the exact window",
    issues: "Closed non-PR issues whose closedAt falls inside the exact window",
    releases: "Repository releases whose publishedAt (or createdAt fallback) falls inside the exact window",
  },
  caveats: [
    "PR counts include release, promotion, propagation, and automation PRs and must not be read as independent features.",
    "Line and file totals are gross GitHub PR metrics; generated files, lockfiles, and overlapping release propagation can inflate them.",
    "Public GitHub data cannot reveal private planning, rejected candidates, unattended runtime, or the amount of human and Agent time.",
  ],
};

const summary = {
  schemaVersion: 1,
  organization,
  window: metadata.window,
  collectedAt,
  totals: {
    ...totals,
    closedIssues: normalizedIssues.length,
    releases: releases.length,
    repositories: normalizedRepositories.length,
    repositoriesWithMergedPullRequests: byRepository.size,
  },
  byRepository: sortSummary(byRepository),
  byShanghaiDay: sortSummary(byShanghaiDay).sort((left, right) => left.name.localeCompare(right.name)),
  byAuthor: sortSummary(byAuthor),
};

writeJson("collection.json", metadata);
writeJson("pull-requests.json", normalizedPullRequests);
writeJson("closed-issues.json", normalizedIssues);
writeJson("releases.json", releases);
writeJson("repositories.json", normalizedRepositories);
writeJson("summary.json", summary);

console.log(
  JSON.stringify(
    {
      outputDirectory,
      window: metadata.window,
      totals: summary.totals,
    },
    null,
    2,
  ),
);

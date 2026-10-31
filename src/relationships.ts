import { REL_TYPES, type RelType, type Relationship } from './db';

/**
 * R3 pure logic: the shape of a link, which types are symmetric, and the graph walk over them. No UI, no Dexie import.
 * Section 6's path search lives here so R4 can reuse it without touching a component.
 */

export { REL_TYPES };

export const REL_LABEL: Record<RelType, string> = {
  family: 'خانواده',
  friend: 'دوست',
  colleague: 'همکار',
  neighbor: 'همسایه',
  classmate: 'هم‌کلاس',
  acquaintance: 'آشنا',
  introduced: 'معرفی‌شده',
};

/** Every type except `introduced` means the same thing from both sides. */
export const isSymmetric = (t: RelType) => t !== 'introduced';

export const CONFIDENCE_LABEL = { sure: 'مطمئن', maybe: 'شاید' } as const;

/**
 * The stored ids for a link. Symmetric types sort the pair so `a→b` and `b→a` are the same row; `introduced` keeps the
 * direction the user chose. Throws on a self-link, because a person cannot be related to themselves (section 5).
 */
export function linkIds(aId: string, bId: string, type: RelType): { aId: string; bId: string } {
  if (aId === bId) throw new Error('self-link');
  if (!isSymmetric(type)) return { aId, bId };
  return aId < bId ? { aId, bId } : { aId: bId, bId: aId };
}

/** The stable row id of a link, so saving the same link twice is an update instead of a second row. */
export const linkId = (aId: string, bId: string, type: RelType) => {
  const ids = linkIds(aId, bId, type);
  return `${ids.aId}|${ids.bId}|${type}`;
};

/** True when the pair already has a link of this type (either direction for symmetric types). */
export function findLink(links: Relationship[], aId: string, bId: string, type: RelType) {
  const id = linkId(aId, bId, type);
  return links.find((l) => l.id === id);
}

/** Every link that touches `personId`, with the other end resolved. */
export function linksOf(links: Relationship[], personId: string) {
  return links
    .filter((l) => l.aId === personId || l.bId === personId)
    .map((l) => {
      // for `introduced`, the "other end" is the person on the other side, and `isFrom` says whether this person did the
      // introducing (aId) or was introduced (bId)
      const isFrom = l.aId === personId;
      return { link: l, otherId: isFrom ? l.bId : l.aId, isFrom };
    })
    .sort((a, b) => (b.link.closeness ?? 0) - (a.link.closeness ?? 0) || a.otherId.localeCompare(b.otherId));
}

/** A link's closeness, defaulted so sorting and display never see `undefined`. */
export const closenessOf = (l: Relationship) => l.closeness ?? 0;

// ---- referral paths (section 6) ----

export type Path = { people: string[]; links: Relationship[]; uncertain: boolean };

/**
 * Shortest paths from `from` (the "me" person) to `to`, depth ≤ maxDepth, cycle-safe.
 * Section 6: shortest path first, ties broken by closeness (higher first) then by name. Only symmetric links are walked:
 * `introduced` is a statement about who introduced whom to the user, not a channel between two other people.
 */
export function findPaths(
  links: Relationship[],
  from: string,
  to: string,
  names: Map<string, string>,
  maxDepth = 3,
): Path[] {
  if (from === to) return [];
  const edges = links.filter((l) => isSymmetric(l.type));
  const adj = new Map<string, { otherId: string; link: Relationship }[]>();
  for (const l of edges) {
    for (const [x, y] of [[l.aId, l.bId], [l.bId, l.aId]] as const) {
      const list = adj.get(x) ?? [];
      list.push({ otherId: y, link: l });
      adj.set(x, list);
    }
  }

  const results: Path[] = [];
  const queue: Path[] = [{ people: [from], links: [], uncertain: false }];
  const bestDepth = new Map<string, number>(); // shortest depth each node was reached at, for cycle safety
  bestDepth.set(from, 0);

  while (queue.length) {
    const path = queue.shift()!;
    const last = path.people[path.people.length - 1];
    if (path.people.length - 1 >= maxDepth) continue;
    for (const { otherId, link } of adj.get(last) ?? []) {
      if (path.people.includes(otherId)) continue; // cycle-safe
      const nextPeople = [...path.people, otherId];
      const nextLinks = [...path.links, link];
      const next: Path = {
        people: nextPeople,
        links: nextLinks,
        uncertain: path.uncertain || link.confidence === 'maybe',
      };
      if (otherId === to) {
        results.push(next);
        continue;
      }
      const depth = nextPeople.length - 1;
      const seen = bestDepth.get(otherId);
      // keep walking from a node only at its shallowest depth; equal depths may yield different (equally short) paths
      if (seen === undefined || depth <= seen) {
        bestDepth.set(otherId, depth);
        queue.push(next);
      }
    }
  }

  const sumCloseness = (p: Path) => p.links.reduce((n, l) => n + closenessOf(l), 0);
  const pathNames = (p: Path) => p.people.map((id) => names.get(id) ?? '').join(' ');
  return results.sort(
    (a, b) =>
      a.people.length - b.people.length || // shortest first
      sumCloseness(b) - sumCloseness(a) || // stronger ties first
      pathNames(a).localeCompare(pathNames(b), 'fa'),
  );
}

/** "من ← رضا ← علی" for display. R4 adds occupation and `maybe` marking on top of this. */
export function pathText(p: Path, names: Map<string, string>) {
  return p.people.map((id) => names.get(id) ?? '؟').join(' ← ');
}

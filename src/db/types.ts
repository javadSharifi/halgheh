import type { Cal } from '../cal';

// Every row has a client-made UUID id and updatedAt so sync can be added later without a migration.
// mask bit = JS weekday. The optional fields were added later; a row without them means: active, no time, no reminder.
export type Task = {
  id: string;
  title: string;
  mask: number;
  start: string;
  end?: string;
  updatedAt: number;
  description?: string;
  time?: string; // 'HH:MM', local
  remindLead?: number; // minutes before `time` to remind; 0 = at the time; missing = no reminder
  active?: boolean; // false = paused
  on?: string; // one-off task: the only date it runs on (mask is 0)
  before?: number[]; // one-off task: also remind this many days ahead (at `time`, or 09:00)
  fromPersonId?: string; // T1: the person who asked for this todo ("چه کسی خواسته")
  snoozeUntil?: number; // T1: epoch ms; while in the future this replaces the normal reminder time (survives re-planning)
};
export type Done = { id: string; taskId: string; date: string; updatedAt: number; doneAt?: number }; // id = `${taskId}|${date}`; doneAt = when it was ticked (ms), missing on old rows
export type Birthday = { id: string; name: string; cal: Cal; month: number; day: number; year?: number; phone?: string; personId?: string; updatedAt: number };

/** A person in the notebook. `isSelf: 1` marks the single "me" row; other rows leave it out. */
export type Person = {
  id: string;
  isSelf?: 1;
  displayName: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phones: string[];
  emails: string[];
  city?: string;
  occupation?: string;
  workplace?: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};
export type Tag = { id: string; name: string; updatedAt: number };
/** One row per person+tag. The id is `${personId}|${tagId}`, so adding the same tag twice is a no-op instead of a duplicate. */
export type PersonTag = { id: string; personId: string; tagId: string; updatedAt: number };
/** A skill in the shared vocabulary. `parentId` is one level deep at most (R1). */
export type Skill = {
  id: string;
  name: string;
  aliases: string[]; // other names the same skill is known by, used by search and autocomplete
  parentId?: string;
  updatedAt: number;
};
/** What one person can do. Evidence is text plus the user's own assessment of that evidence (section 5). */
export type PersonSkill = {
  id: string;
  personId: string;
  skillId: string;
  level?: number; // 1-5
  years?: number;
  evidence?: string;
  evidenceStatus: 'claimed' | 'seen' | 'verified' | 'unknown';
  lastVerifiedAt?: string; // YYYY-MM-DD; stale when older than STALE_MONTHS
  updatedAt: number;
};

/**
 * One rating event. Ratings are append-only (section 5): a new score is a new row, never an edit, so the history of how
 * the user's judgement changed is kept. The current value is the latest row per person+criterion.
 */
export type Rating = {
  id: string;
  personId: string;
  criterion: RatingCriterion;
  score: number; // 1-5
  note?: string;
  ratedAt: string; // YYYY-MM-DD
  updatedAt: number;
};
/** The six fixed criteria (section 5). Constants, never user-editable in the MVP. */
export const RATING_CRITERIA = ['trustworthiness', 'punctuality', 'manner', 'responsibility', 'negotiation', 'responsiveness'] as const;
export type RatingCriterion = (typeof RATING_CRITERIA)[number];

/** Relationship types (section 5). Every type except `introduced` is symmetric. */
export const REL_TYPES = ['family', 'friend', 'colleague', 'neighbor', 'classmate', 'acquaintance', 'introduced'] as const;
export type RelType = (typeof REL_TYPES)[number];

/**
 * A link between two people. Symmetric types are stored once with `aId < bId`, so the same friendship cannot be saved
 * twice from either side; `introduced` is directional (aId introduced bId to the user).
 */
export type Relationship = {
  id: string;
  aId: string;
  bId: string;
  type: RelType;
  closeness?: number; // 1-5
  howMet?: string;
  introducedById?: string; // who made the introduction, when known
  confidence: 'sure' | 'maybe';
  note?: string;
  updatedAt: number;
};

/**
 * Photo metadata (section 5). Only this row is synced; the image file itself stays on the device in `photoFiles`
 * until B2b uploads it. `bytes`, `width` and `height` let the grid reserve space before the file is read.
 */
export type Photo = {
  id: string;
  title: string;
  note?: string;
  takenAt: string; // YYYY-MM-DD, never a timezone-shifted instant
  personId?: string;
  tagIds: string[];
  width: number;
  height: number;
  bytes: number;
  updatedAt: number;
};
/**
 * Device-local pointer to the image file. Never synced: a restored phone gets the metadata first and downloads the
 * files afterwards (B2b). `uploadState` tracks that queue.
 */
export type PhotoFile = {
  photoId: string; // primary key: one file per photo
  path: string; // path inside the app data directory
  uploadState: 'local' | 'uploaded' | 'failed';
  updatedAt: number;
};

/**
 * A category of the personal rulebook (phase 1). `compareEnabled` turns on purchase comparison for this category only,
 * which is why it sits on the category rather than on the rule.
 */
export type RuleCategory = {
  id: string;
  name: string;
  sortOrder: number;
  compareEnabled?: boolean;
  updatedAt: number;
};

/**
 * One rule the user wrote for themselves. `box`/`nextReviewOn` are a cache of the review history (see
 * `domain/rules/schedule.ts`), never the source of truth. `nextReviewOn` is a `YYYY-MM-DD` date, never a timezone-shifted
 * instant; `lastReviewedAt` is an ISO UTC instant. `strict` marks a deal-breaker used by the purchase comparison.
 */
export type Rule = {
  id: string;
  categoryId: string;
  title: string;
  why?: string;
  pinned?: boolean;
  strict?: boolean;
  box: number; // 0-6
  nextReviewOn: string; // YYYY-MM-DD
  lastReviewedAt?: string; // ISO UTC
  reviewCount: number;
  brokenCount: number;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};

/**
 * One review event, append-only (like `ratings`): the box and due date of the rule are derived from these rows, so the
 * history can always rebuild them. `reviewedAt` is the ISO UTC instant; `reviewedOn` is the same review's day as
 * `YYYY-MM-DD`, which is the only field the replay is allowed to use so a different timezone cannot move a day.
 */
export type RuleReview = {
  id: string;
  ruleId: string;
  reviewedAt: string; // ISO UTC
  reviewedOn: string; // YYYY-MM-DD, the review's own day
  result: 'remembered' | 'forgot' | 'broke';
  note?: string;
  updatedAt: number;
};

/** A purchase-comparison session (phase 5). `open` sessions are listed first; `decided` ones stay readable. */
export type CompareSession = {
  id: string;
  categoryId: string;
  title: string;
  status: 'open' | 'decided';
  chosenItemId?: string;
  decisionNote?: string;
  createdAt: number;
  updatedAt: number;
};

/** One item seen in one shop. The same model seen in two shops is two items on purpose. */
export type CompareItem = {
  id: string;
  sessionId: string;
  name: string;
  shopName?: string;
  price?: number; // Toman, shown with Persian digits by the existing format helpers
  seenOn: string; // YYYY-MM-DD
  note?: string;
  updatedAt: number;
};

/** One rule checked against one item. A missing row means `unknown`, so `unknown` rows are never written. */
export type CompareCheck = {
  id: string; // `${itemId}|${ruleId}`, so the same pair cannot be stored twice
  itemId: string;
  ruleId: string;
  state: 'pass' | 'fail' | 'unknown';
  note?: string;
  updatedAt: number;
};

/**
 * One time I broke a rule, and what I learned from it (Part 1). This table — not `rules.brokenCount` — is the single
 * source of truth: the count is derived from these rows, so creating or deleting one is the only thing that moves it.
 * `personId` is set only when the user picks someone; `brokenOn` is a `YYYY-MM-DD` day, never an instant.
 */
export type RuleBreak = {
  id: string;
  ruleId: string;
  brokenOn: string; // YYYY-MM-DD
  personId?: string; // optional link, chosen by the user
  whatHappened?: string;
  whyBroke?: string;
  nextTimePlan?: string;
  updatedAt: number;
};

/**
 * A rule check for one person before doing something with them (Part 2): "قرض دادن به رضا". `status` is `open` while the
 * user is still thinking and `closed` once they are done; a closed check stays readable and can be reopened.
 */
export type RuleCheck = {
  id: string;
  personId: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
};

/**
 * One rule's state inside a check. A missing row means `unknown`, so `unknown` is never written and never counted as
 * breaking. `keeping` and `breaking` are the two answers that count; `na` ("مربوط نیست") is a decision, not a blank.
 */
export type RuleCheckItem = {
  id: string; // `${checkId}|${ruleId}`
  checkId: string;
  ruleId: string;
  state: 'keeping' | 'breaking' | 'na' | 'unknown';
  note?: string;
  updatedAt: number;
};

/**
 * One thing that went back and forth with a person (Part 3): money I gave or received, an item lent or borrowed, a favour.
 * `amount` exists only for `kind: 'money'`, and only money ever produces a balance — items and favours are never turned
 * into a number. `dueOn` is a `YYYY-MM-DD` day; `open` means it has not been settled yet.
 */
export type Exchange = {
  id: string;
  personId: string;
  direction: 'gave' | 'received';
  kind: 'money' | 'item' | 'favor' | 'other';
  title: string;
  amount?: number; // Toman, money only
  date: string; // YYYY-MM-DD
  dueOn?: string; // YYYY-MM-DD
  status: 'open' | 'settled';
  settledOn?: string; // YYYY-MM-DD
  note?: string;
  updatedAt: number;
};

/**
 * One payment against an exchange (Part 3). Only money uses it: a favour or an item is settled in one step, because
 * "half a favour" is not a thing the user asked for. Deleting the last settlement reopens the exchange.
 */
export type ExchangeSettlement = {
  id: string;
  exchangeId: string;
  date: string; // YYYY-MM-DD
  amount?: number; // Toman, money only
  note?: string;
  updatedAt: number;
};

export type PersonNote = { id: string; personId: string; text: string; updatedAt: number };
export type Interaction = {
  id: string;
  personId: string;
  type: 'meeting' | 'call' | 'message' | 'other';
  occurredAt: string; // YYYY-MM-DD
  summary: string;
  outcome?: string;
  followUpDate?: string; // YYYY-MM-DD
  updatedAt: number;
};

export type TableName =
  | 'tasks'
  | 'done'
  | 'birthdays'
  | 'people'
  | 'tags'
  | 'personTags'
  | 'personNotes'
  | 'interactions'
  | 'skills'
  | 'personSkills'
  | 'ratings'
  | 'relationships'
  | 'photos'
  | 'ruleCategories'
  | 'rules'
  | 'ruleReviews'
  | 'compareSessions'
  | 'compareItems'
  | 'compareChecks'
  | 'ruleBreaks'
  | 'ruleChecks'
  | 'ruleCheckItems'
  | 'exchanges'
  | 'exchangeSettlements';

/** A local change not yet sent to the server (only used when sync is on). Latest change per row wins. */
export type Outbox = { key: string; t: TableName; id: string; deleted: 0 | 1; updatedAt: number; op?: 'create' | 'edit' | 'delete' }; // op is for the sync screen only; missing on old entries

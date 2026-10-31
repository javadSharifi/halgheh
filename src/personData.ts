import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, type Interaction, type Person, type PersonNote, type PersonSkill, type PersonTag, type Photo, type Rating, type Relationship, type Skill, type Tag, type Task, db } from './db';

/** Everything one profile shows, loaded in one live query so a save anywhere repaints the whole page. */
export type PersonBundle = {
  person: Person;
  birthday: Birthday | undefined;
  notes: PersonNote[];
  interactions: Interaction[];
  tags: Tag[];
  tagLinks: PersonTag[];
  /** R1: what this person can do, plus the shared vocabulary for names and autocomplete. */
  personSkills: PersonSkill[];
  skills: Skill[];
  /** R2: every rating event for this person, newest first. The profile never collapses them into one number. */
  ratings: Rating[];
  /** R3: every link that touches this person (already resolved by the page), plus everyone, for the pickers. */
  relationships: Relationship[];
  everyone: Person[];
  /** G2: photos linked to this person, and their device-local files for thumbnails. */
  photos: Photo[];
  photoFiles: { photoId: string; path: string }[];
  /** T2: todos this person asked for ("کارهایی که گفته"). */
  askedTasks: Task[];
  /** T2: todos the user finished that this person asked for, so the profile can say how dependable they were. */
  askedDone: Set<string>;
};

export const personBundle = (id: string) =>
  useLiveQuery(async (): Promise<PersonBundle | null> => {
    const person = await db.people.get(id);
    if (!person) return null;
    const [birthday, notes, interactions, links, tasks, done, personSkills, skills, ratings, rels, everyone, photos] = await Promise.all([
      db.birthdays.where('personId').equals(id).first(),
      db.personNotes.where('personId').equals(id).toArray(),
      db.interactions.where('personId').equals(id).toArray(),
      db.personTags.where('personId').equals(id).toArray(),
      // fromPersonId is not indexed and the task table is small, so a scan is cheaper than another schema version
      db.tasks.filter((t) => t.fromPersonId === id).toArray(),
      db.done.toArray(),
      db.personSkills.where('personId').equals(id).toArray(),
      db.skills.toArray(),
      db.ratings.where('personId').equals(id).toArray(),
      db.relationships.filter((r) => r.aId === id || r.bId === id).toArray(),
      db.people.toArray(),
      db.photos.where('personId').equals(id).toArray(),
    ]);
    const files = await db.photoFiles.bulkGet(photos.map((p) => p.id));
    const tags = (await db.tags.bulkGet(links.map((l) => l.tagId))).filter((t): t is Tag => !!t);
    return {
      person,
      birthday,
      notes: notes.sort((a, b) => b.updatedAt - a.updatedAt),
      // newest first; an interaction may be a future plan, so this sorts by the date it happened/will happen
      interactions: interactions.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      tags: tags.sort((a, b) => a.name.localeCompare(b.name, 'fa')),
      tagLinks: links,
      personSkills,
      skills,
      ratings: ratings.sort((a, b) => b.ratedAt.localeCompare(a.ratedAt) || b.updatedAt - a.updatedAt),
      relationships: rels,
      everyone,
      photos: photos.sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
      photoFiles: files.filter((f): f is { photoId: string; path: string; uploadState: 'local' | 'uploaded' | 'failed'; updatedAt: number } => !!f),
      askedTasks: tasks.sort((a, b) => (a.on ?? '9999').localeCompare(b.on ?? '9999')),
      askedDone: new Set(done.map((d) => d.taskId)),
    };
  }, [id]);

/** A note is one row per person in the MVP: the latest text wins, so the profile does not need a list editor yet. */
export const primaryNote = (notes: PersonNote[]) => notes[0];

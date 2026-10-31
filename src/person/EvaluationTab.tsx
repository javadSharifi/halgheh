import { fa } from '../cal';
import type { Person, PersonSkill, Rating, RatingCriterion, Relationship, Rule, RuleCheck, RuleCheckItem, Skill } from '../db';
import { checkCounts } from '../domain/rules/personCheck';
import { Icon } from '../Icon';
import { PersonChecks } from '../PersonCheck';
import { CRITERION_LABEL, SCORES, currentRatings, isScore } from '../ratings';
import { REL_LABEL, closenessOf, linksOf } from '../relationships';
import { STATUS_LABEL, STATUS_RANK, isStale, orderPersonSkills, staleText } from '../skills';
import { STR } from '../strings/rulebook';

/** Tab 3: the six independent ratings, skills, relationships, and the rule-check history. */
export function EvaluationTab({ personId, personSkills, skills, ratings, relationships, everyone, checks, allRules, checkItems, onRate, onSkill, onRel, onNewCheck, openCheck }: {
  personId: string;
  personSkills: PersonSkill[];
  skills: Skill[];
  ratings: Rating[];
  relationships: Relationship[];
  everyone: Person[];
  checks: RuleCheck[];
  allRules: Rule[];
  checkItems: RuleCheckItem[];
  onRate: (criterion: RatingCriterion) => void;
  onSkill: (id: string) => void;
  onRel: (id: string) => void;
  onNewCheck: () => void;
  openCheck: (id: string) => void;
}) {
  const mySkills = orderPersonSkills(personSkills, skills);
  const myRatings = currentRatings(ratings);
  const myLinks = linksOf(relationships, personId);
  const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? '';
  const personName = (id: string) => everyone.find((x) => x.id === id)?.displayName ?? 'کسی';
  const newestCheck = [...checks].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return (
    <div className="tab-pane">
      <section>
        <h2 className="sec-title" style={{ marginTop: 0 }}>امتیازها</h2>
        <div className="glass rate-grid">
          {myRatings.map(({ criterion, latest }) => (
            <button key={criterion} className="rate-cell" onClick={() => onRate(criterion)} aria-label={`${CRITERION_LABEL[criterion]}${latest ? `: ${fa(latest.score)} از ۵` : ': ثبت نشده'}`}>
              <span className="rate-name">{CRITERION_LABEL[criterion]}</span>
              {latest && isScore(latest.score) ? (
                <span className="rate-dots" aria-hidden="true">
                  {SCORES.map((s) => <i key={s} className={s <= latest.score ? 'on' : ''} />)}
                </span>
              ) : (
                <span className="rate-dots" aria-hidden="true">{SCORES.map((s) => <i key={s} />)}</span>
              )}
              <span className="rate-value">{latest ? `${fa(latest.score)} از ۵` : 'ثبت نشده'}</span>
            </button>
          ))}
        </div>
        <p className="hint rate-note">هر مورد جدا ارزیابی می‌شود؛ این‌ها با هم جمع یا میانگین نمی‌شوند.</p>
      </section>

      <section>
        <div className="section-head">
          <h2>مهارت‌ها</h2>
          <button className="text-btn" onClick={() => onSkill('new')}><Icon name="plus" size={14} stroke={2.4} />افزودن</button>
        </div>
        {mySkills.length === 0 ? (
          <div className="glass empty-state small">
            <b>مهارتی ثبت نشده</b>
            <p className="hint">این آدم چه کاری را خوب انجام می‌دهد؟ مهارت و اینکه چقدر مطمئنی را اینجا بنویس.</p>
          </div>
        ) : (
          <div className="glass set-list">
            {mySkills.map((row) => {
              const stale = isStale(row);
              return (
                <button key={row.id} className="set-row as-btn" onClick={() => onSkill(row.id)}>
                  <span className={`tile ${STATUS_RANK[row.evidenceStatus] >= 3 ? 'green' : STATUS_RANK[row.evidenceStatus] === 2 ? 'blue' : 'purple'}`} aria-hidden="true">
                    <Icon name="toolbox" size={16} stroke={1.9} />
                  </span>
                  <span className="set-name">
                    {skillName(row.skillId)}
                    <small className="set-sub">
                      {STATUS_LABEL[row.evidenceStatus]}
                      {row.level !== undefined ? ` · سطح ${fa(row.level)}` : ''}
                      {row.years !== undefined ? ` · ${fa(row.years)} سال` : ''}
                      {stale ? ' · کهنه' : ''}
                    </small>
                  </span>
                  {stale && <em className="due-chip" title={staleText()}>کهنه</em>}
                  <Icon name="chevronLeft" size={16} stroke={2} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>رابطه‌ها</h2>
          <button className="text-btn" onClick={() => onRel('new')}><Icon name="plus" size={14} stroke={2.4} />افزودن</button>
        </div>
        {myLinks.length === 0 ? (
          <div className="glass empty-state small">
            <b>رابطه‌ای ثبت نشده</b>
            <p className="hint">این آدم را چطور می‌شناسی، و چه‌قدر نزدیک است؟</p>
          </div>
        ) : (
          <div className="glass set-list">
            {myLinks.map(({ link, otherId, isFrom }) => (
              <button key={link.id} className="set-row as-btn" onClick={() => onRel(link.id)}>
                <span className={`tile ${link.confidence === 'maybe' ? 'peach' : 'green'}`} aria-hidden="true">
                  <Icon name="users" size={16} stroke={1.9} />
                </span>
                <span className="set-name">
                  {personName(otherId)}
                  <small className="set-sub">
                    {REL_LABEL[link.type]}
                    {link.type === 'introduced' ? (isFrom ? ' · او را معرفی کرد' : ' · او معرفی‌ات کرد') : ''}
                    {link.closeness !== undefined ? ` · نزدیکی ${fa(closenessOf(link))}` : ''}
                    {link.confidence === 'maybe' ? ' · شاید' : ''}
                  </small>
                </span>
                <Icon name="chevronLeft" size={16} stroke={2} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>{STR.personCheck.history}</h2>
          <button className="text-btn" onClick={onNewCheck}><Icon name="plus" size={14} stroke={2.4} />{STR.personCheck.newTitle}</button>
        </div>
        {newestCheck && (
          <p className="hint pp-sum">
            {fa(checkCounts(allRules.filter((r) => !r.archivedAt), checkItems.filter((i) => i.checkId === newestCheck.id)).keeping)} {STR.personCheck.keepingCount} ·{' '}
            {fa(checkCounts(allRules.filter((r) => !r.archivedAt), checkItems.filter((i) => i.checkId === newestCheck.id)).breaking)} {STR.personCheck.breakingCount}
          </p>
        )}
        <PersonChecks personId={personId} checks={[...checks].sort((a, b) => b.updatedAt - a.updatedAt)} onOpen={openCheck} />
      </section>
    </div>
  );
}

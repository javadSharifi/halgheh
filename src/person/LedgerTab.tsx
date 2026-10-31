import { fa, today } from '../cal';
import type { Exchange, ExchangeSettlement, Photo } from '../db';
import { balancesByPerson, dueText, isSettled, orderExchanges } from '../domain/ledger';
import { Icon } from '../Icon';
import { BalanceChips } from '../ledger/ExchangeItem';
import { money } from '../ledger/shared';
import { STR } from '../strings/rulebook';
import { tx } from '../i18n';

/** Tab 4: open exchanges with this person, the brief entry, and their photos. */
export function LedgerTab({ personId, exchanges, settlements, photos, photoUrls, openLedger, openBrief, onExchange }: {
  personId: string;
  exchanges: Exchange[];
  settlements: ExchangeSettlement[];
  photos: Photo[];
  photoUrls: Record<string, string>;
  openLedger: () => void;
  openBrief: () => void;
  onExchange: (e: Exchange | 'new') => void;
}) {
  const myExchanges = orderExchanges(exchanges, settlements);
  const openExchanges = myExchanges.filter((e) => !isSettled(e, settlements));
  const myBalance = balancesByPerson(exchanges, settlements).get(personId);

  return (
    <div className="tab-pane">
      <section>
        <div className="section-head">
          <h2>{tx('دادوستد')}</h2>
          <button className="text-btn" onClick={() => onExchange('new')}><Icon name="plus" size={14} stroke={2.4} />{tx(STR.ledger.quickAdd)}</button>
        </div>
        {myBalance ? (
          <div className="pp-balance">
            <BalanceChips earn={myBalance.earn} owe={myBalance.owe} />
            <small className="hint">{tx(STR.ledger.moneyOnlyChip)}</small>
          </div>
        ) : (
          <p className="hint">{tx(STR.ledger.nothingForPerson)}</p>
        )}
        {openExchanges.length > 0 && (
          <div className="glass set-list">
            {openExchanges.map((e) => (
              <button key={e.id} className="set-row as-btn" onClick={() => onExchange(e)}>
                <span className={`tile ${e.direction === 'gave' ? 'blue' : 'peach'}`} aria-hidden="true">
                  <Icon name={e.direction === 'gave' ? 'upload' : 'download'} size={16} stroke={1.9} />
                </span>
                <span className="set-name">
                  {e.title}
                  <small className="set-sub">
                    {tx(STR.ledger[e.direction])}
                    {e.kind === 'money' && e.amount !== undefined ? ` · ${money(e.amount)}` : ''}
                    {e.dueOn ? ` · ${dueText(e.dueOn, today(), fa)}` : ''}
                  </small>
                </span>
                <Icon name="chevronLeft" size={16} stroke={2} />
              </button>
            ))}
          </div>
        )}
        <button className="text-btn pp-ledger" onClick={openLedger}>{tx(STR.ledger.title)}</button>
      </section>

      <section>
        <div className="section-head">
          <h2>{tx(STR.brief.title)}</h2>
          <button className="pill-btn" onClick={openBrief}><Icon name="note" size={15} stroke={2.2} />{tx(STR.brief.entry)}</button>
        </div>
        <p className="hint">{tx(STR.brief.readOnly)}</p>
      </section>

      <section>
        <div className="section-head">
          <h2>{tx('عکس‌ها')}</h2>
          <span className="hint">{photos.length ? tx('{a1} عکس', { a1: fa(photos.length) }) : ''}</span>
        </div>
        {photos.length === 0 ? (
          <div className="glass empty-state small">
            <b>{tx('عکسی به او وصل نیست')}</b>
            <p className="hint">{tx('در گالری، هنگام ویرایش عکس، این فرد را انتخاب کن.')}</p>
          </div>
        ) : (
          <div className="photo-grid person-photos">
            {photos.map((ph) => (
              <div key={ph.id} className="photo-cell" aria-label={ph.title} title={ph.title}>
                {photoUrls[ph.id] ? (
                  <img src={photoUrls[ph.id]} alt="" loading="lazy" />
                ) : (
                  <span className="photo-missing" aria-hidden="true"><Icon name="image" size={18} stroke={1.8} /></span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="sec-title">{tx('بعداً')}</h2>
        <div className="glass set-list">
          <div className="soon-row"><span className="tile purple" aria-hidden="true"><Icon name="image" size={16} stroke={1.9} /></span><span>{tx('عکس‌ها')}</span><em>G2</em></div>
        </div>
      </section>
    </div>
  );
}

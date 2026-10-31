import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Exchange, db } from './db';
import { fa, today } from './cal';
import { Icon } from './Icon';
import { STR } from './strings/rulebook';
import {
  balancesByPerson,
  groupByPerson,
  isMoney,
  isOverdue,
  isSettled,
  remainingOf,
} from './domain/ledger';
import { PALETTE, money } from './ledger/shared';
import { LedgerHero } from './ledger/LedgerHero';
import { BalanceChips, ExchangeItem } from './ledger/ExchangeItem';
import { ExchangeSheet } from './ledger/ExchangeSheet';
import { SettleSheet } from './ledger/SettleSheet';

export { money, BalanceChips };
export { ExchangeSheet };

type ExtendedFilter = 'all' | 'earn' | 'owe' | 'nonmoney' | 'overdue' | 'settled';

/**
 * Ledger Page:
 * - Executive Hero Dashboard with net financial standing, total earn/owe, non-money items, and overdue alert
 * - Live real-time search across people, titles, and notes
 * - Filter pills with live counts
 * - Clean Person Glass Cards with balance badges and quick add
 * - Rich transaction rows with progress bars for partial payments and overdue chips
 * - Direct tap to edit, settle, or delete
 */
export function LedgerPage({ openPerson, openCheck }: { openPerson: (id: string) => void; openCheck: (id: string) => void }) {
  const exchanges = useLiveQuery(() => db.exchanges.toArray(), []) ?? [];
  const settlements = useLiveQuery(() => db.exchangeSettlements.toArray(), []) ?? [];
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const checks = useLiveQuery(() => db.ruleChecks.toArray(), []) ?? [];

  const [filter, setFilter] = useState<ExtendedFilter>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null | 'new'>(null);
  const [editing, setEditing] = useState<Exchange | null>(null);
  const [settling, setSettling] = useState<Exchange | null>(null);
  const t = today();

  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.displayName])), [people]);
  const balances = useMemo(() => balancesByPerson(exchanges, settlements), [exchanges, settlements]);

  // Overall financial calculations
  const { totalEarn, totalOwe, openEarnCount, openOweCount, nonMoneyCount, overdueCount } = useMemo(() => {
    let earn = 0;
    let owe = 0;
    let eCount = 0;
    let oCount = 0;
    let nmCount = 0;
    let odCount = 0;

    for (const e of exchanges) {
      const settled = isSettled(e, settlements);
      if (!settled) {
        if (isOverdue(e, t)) odCount++;
        if (isMoney(e)) {
          const left = remainingOf(e, settlements) ?? 0;
          if (e.direction === 'gave') {
            earn += left;
            eCount++;
          } else {
            owe += left;
            oCount++;
          }
        } else {
          nmCount++;
        }
      }
    }
    return {
      totalEarn: earn,
      totalOwe: owe,
      openEarnCount: eCount,
      openOweCount: oCount,
      nonMoneyCount: nmCount,
      overdueCount: odCount,
    };
  }, [exchanges, settlements, t]);

  // Filter & Search Logic
  const filteredExchanges = useMemo(() => {
    let list = exchanges;

    // Filter by tab
    if (filter === 'all') {
      list = list.filter((e) => !isSettled(e, settlements));
    } else if (filter === 'earn') {
      list = list.filter((e) => isMoney(e) && !isSettled(e, settlements) && e.direction === 'gave');
    } else if (filter === 'owe') {
      list = list.filter((e) => isMoney(e) && !isSettled(e, settlements) && e.direction === 'received');
    } else if (filter === 'nonmoney') {
      list = list.filter((e) => !isMoney(e) && !isSettled(e, settlements));
    } else if (filter === 'overdue') {
      list = list.filter((e) => !isSettled(e, settlements) && isOverdue(e, t));
    } else if (filter === 'settled') {
      list = list.filter((e) => isSettled(e, settlements));
    }

    // Filter by search query
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const personName = (nameOf.get(e.personId) ?? '').toLowerCase();
        const title = (e.title ?? '').toLowerCase();
        const note = (e.note ?? '').toLowerCase();
        const amountStr = e.amount !== undefined ? String(e.amount) : '';
        return personName.includes(q) || title.includes(q) || note.includes(q) || amountStr.includes(q);
      });
    }

    return list;
  }, [exchanges, settlements, filter, search, nameOf, t]);

  const personOrder = useMemo(() => {
    const ids = [...new Set(filteredExchanges.map((e) => e.personId))];
    return ids.sort((a, b) => (nameOf.get(a) ?? '').localeCompare(nameOf.get(b) ?? '', 'fa'));
  }, [filteredExchanges, nameOf]);

  const groups = useMemo(
    () => groupByPerson(filteredExchanges, settlements, personOrder),
    [filteredExchanges, settlements, personOrder],
  );

  return (
    <div className="ledger-container">
      {/* Page Header */}
      <div className="page-head">
        <div className="ledger-title-wrap">
          <h1>{STR.ledger.title}</h1>
          <span className="ledger-title-count">
            {fa(openEarnCount + openOweCount + nonMoneyCount)} باز
          </span>
        </div>
        <button className="primary ledger-quick-add-btn" onClick={() => setAdding('new')}>
          <Icon name="plus" size={17} stroke={2.4} />
          <span>{STR.ledger.quickAdd}</span>
        </button>
      </div>

      {/* Hero Financial Summary Card */}
      {exchanges.length > 0 && (
        <LedgerHero
          totalEarn={totalEarn}
          totalOwe={totalOwe}
          openEarnCount={openEarnCount}
          openOweCount={openOweCount}
          nonMoneyCount={nonMoneyCount}
          overdueCount={overdueCount}
          onShowOverdue={() => setFilter('overdue')}
        />
      )}

      {/* Search Input Bar */}
      {exchanges.length > 0 && (
        <div className="ledger-search-box">
          <Icon name="search" size={18} stroke={2} className="ledger-search-icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در نام شخص، موضوع، یادداشت یا مبلغ..."
            aria-label="جستجو در دادوستدها"
          />
          {search && (
            <button
              type="button"
              className="icon-btn small ledger-search-clear"
              onClick={() => setSearch('')}
              aria-label="پاک کردن جستجو"
            >
              <Icon name="close" size={14} stroke={2.2} />
            </button>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="tabs ledger-tabs" role="tablist" aria-label="فیلترهای دادوستد">
        <button
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? 'on' : ''}
          onClick={() => setFilter('all')}
        >
          همهٔ بازها ({fa(openEarnCount + openOweCount + nonMoneyCount)})
        </button>
        <button
          role="tab"
          aria-selected={filter === 'earn'}
          className={filter === 'earn' ? 'on tab-earn' : ''}
          onClick={() => setFilter('earn')}
        >
          طلب‌های من ({fa(openEarnCount)})
        </button>
        <button
          role="tab"
          aria-selected={filter === 'owe'}
          className={filter === 'owe' ? 'on tab-owe' : ''}
          onClick={() => setFilter('owe')}
        >
          بدهی‌های من ({fa(openOweCount)})
        </button>
        <button
          role="tab"
          aria-selected={filter === 'nonmoney'}
          className={filter === 'nonmoney' ? 'on tab-items' : ''}
          onClick={() => setFilter('nonmoney')}
        >
          امانت و لطف ({fa(nonMoneyCount)})
        </button>
        {overdueCount > 0 && (
          <button
            role="tab"
            aria-selected={filter === 'overdue'}
            className={filter === 'overdue' ? 'on tab-overdue' : 'tab-overdue-chip'}
            onClick={() => setFilter('overdue')}
          >
            سررسید گذشته ({fa(overdueCount)})
          </button>
        )}
        <button
          role="tab"
          aria-selected={filter === 'settled'}
          className={filter === 'settled' ? 'on' : ''}
          onClick={() => setFilter('settled')}
        >
          تسویه‌شده‌ها
        </button>
      </div>

      {/* Main Content Area */}
      {exchanges.length === 0 ? (
        <section className="glass empty-state ledger-empty-welcome">
          <span className="tile blue" aria-hidden="true">
            <Icon name="repeat" size={28} stroke={1.8} />
          </span>
          <b>هنوز هیچ دادوستدی ثبت نکرده‌اید</b>
          <p className="hint">
            قرض‌هایی که دادید، بدهی‌ها، کالاهایی که امانت دادید یا گرفتید، و لطف‌هایی که برای هم انجام دادید را اینجا منظم نگه دارید.
          </p>
          <button className="primary" onClick={() => setAdding('new')}>
            <Icon name="plus" size={17} stroke={2.4} />
            ثبت اولین دادوستد
          </button>
        </section>
      ) : groups.length === 0 ? (
        <div className="glass ledger-empty-search">
          <Icon name="search" size={24} stroke={1.8} />
          <b>دادوستدی با این مشخصات پیدا نشد</b>
          <p className="hint">می‌توانید عبارت جستجو را تغییر دهید یا فیلتر دیگری را انتخاب کنید.</p>
          {(search || filter !== 'all') && (
            <button
              className="text-btn"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              نمایش همه دادوستدهای باز
            </button>
          )}
        </div>
      ) : (
        <div className="ledger-groups">
          {groups.map((g) => {
            const personBalance = balances.get(g.personId);
            const pName = nameOf.get(g.personId) ?? 'شخص نامشخص';
            const pal = PALETTE(pName);

            return (
              <section key={g.personId} className="glass ledger-person-card">
                {/* Person Header */}
                <div className="ledger-person-header">
                  <button className="ledger-person-meta" onClick={() => openPerson(g.personId)} title="مشاهده پروفایل">
                    <span className={`avatar p${pal}`} aria-hidden="true">
                      {pName.slice(0, 1)}
                    </span>
                    <div className="ledger-person-title-col">
                      <b>{pName}</b>
                      <span className="ledger-person-badge-link">
                        مشاهده سوابق و پروفایل
                        <Icon name="chevronLeft" size={12} stroke={2.2} />
                      </span>
                    </div>
                  </button>

                  <div className="ledger-person-header-actions">
                    {personBalance && <BalanceChips earn={personBalance.earn} owe={personBalance.owe} />}
                    <button
                      className="icon-btn small ledger-add-to-person-btn"
                      onClick={() => setAdding(g.personId)}
                      title={`ثبت دادوستد با ${pName}`}
                      aria-label={`ثبت دادوستد با ${pName}`}
                    >
                      <Icon name="plus" size={16} stroke={2.4} />
                    </button>
                  </div>
                </div>

                {/* Exchanges List */}
                <div className="ledger-items-list">
                  {g.exchanges.map((e) => (
                    <ExchangeItem
                      key={e.id}
                      exchange={e}
                      settlements={settlements}
                      today={t}
                      onSettle={() => setSettling(e)}
                      onEdit={() => setEditing(e)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Add / Edit Sheet Modal */}
      {(adding || editing) && (
        <ExchangeSheet
          people={people.filter((p) => !p.archivedAt && !p.isSelf)}
          seedPersonId={adding && adding !== 'new' ? adding : editing ? editing.personId : undefined}
          exchange={editing}
          onClose={() => {
            setAdding(null);
            setEditing(null);
          }}
          onStartCheck={openCheck}
          checks={checks}
        />
      )}

      {/* Settle Modal */}
      {settling && (
        <SettleSheet
          exchange={settling}
          settlements={settlements.filter((s) => s.exchangeId === settling.id)}
          personName={nameOf.get(settling.personId) ?? 'طرف حساب'}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}

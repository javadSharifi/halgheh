import { useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Sheet } from './ui';
import { tk, tx } from './i18n';

export type AddKind = 'task' | 'person' | 'exchange' | 'birthday' | 'rule';

const ITEMS: { kind: AddKind; icon: IconName; tone: string; name: string }[] = [
  { kind: 'task', icon: 'listChecks', tone: 'blue', name: tk('کار تازه') },
  { kind: 'person', icon: 'users', tone: 'purple', name: tk('فرد جدید') },
  { kind: 'exchange', icon: 'repeat', tone: 'peach', name: tk('دادوستد') },
  { kind: 'birthday', icon: 'cake', tone: 'green', name: tk('تولد یا مناسبت') },
  { kind: 'rule', icon: 'target', tone: 'purple', name: tk('قانون') },
];

/** The global "+": one button on every tab that opens the add page of whatever the user wants to create. */
export function AddMenu({ onPick }: { onPick: (k: AddKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="add-fab primary" aria-label={tx('افزودن')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="plus" size={26} stroke={2.4} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tx('چه چیزی اضافه کنم؟')}>
        <div className="set-list">
          {ITEMS.map((i) => (
            <button key={i.kind} type="button" className="set-row as-btn" onClick={() => { setOpen(false); onPick(i.kind); }}>
              <span className={`tile ${i.tone}`} aria-hidden="true"><Icon name={i.icon} size={17} stroke={1.9} /></span>
              <span className="set-name">{tx(i.name)}</span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

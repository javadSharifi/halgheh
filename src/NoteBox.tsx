import { useEffect, useRef, useState } from 'react';
import type { PersonNote } from './db';
import { Icon } from './Icon';
import { Button, Card, InputField } from './ui';
import { tx } from './i18n';

/**
 * The person's free-text note. One row per person in the MVP, so this is a single box: it saves on blur and when the
 * profile closes, not on every keystroke, so a half-typed line does not sync ten times.
 */
export function NoteBox({ note, onSave }: { note: PersonNote | undefined; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(note?.text ?? '');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done'>('idle');
  const last = useRef(note?.text ?? '');

  useEffect(() => {
    // another device (or another screen) changed the note; do not stomp on what is being typed here
    if (note && note.text !== last.current && text === last.current) {
      setText(note.text);
      last.current = note.text;
    }
  }, [note, text]);

  const commit = async () => {
    if (text === last.current) return;
    setSaved('saving');
    try {
      await onSave(text);
      last.current = text;
      setSaved('done');
      window.setTimeout(() => setSaved('idle'), 1600);
    } catch {
      setSaved('idle');
    }
  };

  return (
    <Card className="note-box">
      <InputField
        multiline
        rows={4}
        label={tx('یادداشت خصوصی')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder={tx('هر چیزی که باید یادت بماند…')}
        maxLength={4000}
      />
      <div className="note-foot">
        {saved === 'saving' ? (
          <span className="hint"><Icon name="refresh" size={13} stroke={2} />{tx('در حال ذخیره…')}</span>
        ) : saved === 'done' ? (
          <span className="hint"><Icon name="checkCircle" size={13} stroke={2} />{tx('ذخیره شد')}</span>
        ) : (
          <span className="hint">{text.trim() ? tx('خودکار ذخیره می‌شود') : tx('خالی')}</span>
        )}
        <Button variant="ghost" size="sm" disabled={text === last.current} onClick={commit}>{tx('ذخیره')}</Button>
      </div>
    </Card>
  );
}

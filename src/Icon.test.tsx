import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ICON_NAMES, Icon } from './Icon';

test('every icon renders an svg with drawing elements', () => {
  expect(ICON_NAMES.length).toBeGreaterThan(30);
  for (const name of ICON_NAMES) {
    const html = renderToStaticMarkup(<Icon name={name} />);
    expect(html, name).toMatch(/^<svg[^>]*aria-hidden="true">.*<(path|circle|rect|ellipse)/);
  }
});

import { expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputField } from './InputField';

test('InputField renders label above input and displays placeholder', () => {
  const html = renderToStaticMarkup(
    <InputField
      label="عنوان کار"
      required
      hint="واضح بنویسید"
      placeholder="مثلاً: هماهنگی با رضا"
    />
  );

  expect(html).toContain('عنوان کار');
  expect(html).toContain('*');
  expect(html).toContain('واضح بنویسید');
  expect(html).toContain('مثلاً: هماهنگی با رضا');
  expect(html).toContain('input-label-row');
});

test('InputField renders textarea when multiline is true', () => {
  const html = renderToStaticMarkup(
    <InputField
      multiline
      label="یادداشت"
      placeholder="توضیحات..."
    />
  );

  expect(html).toContain('<textarea');
  expect(html).toContain('توضیحات...');
});

test('InputField displays error when provided', () => {
  const html = renderToStaticMarkup(
    <InputField
      label="نام"
      error="این فیلد الزامی است"
    />
  );

  expect(html).toContain('این فیلد الزامی است');
  expect(html).toContain('has-error');
  expect(html).toContain('role="alert"');
});

test('InputField renders icon when specified', () => {
  const html = renderToStaticMarkup(
    <InputField
      label="عنوان"
      icon="edit"
    />
  );

  expect(html).toContain('has-icon');
  expect(html).toContain('input-icon-slot');
  expect(html).toContain('<svg');
});

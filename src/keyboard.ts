/**
 * Publishes the on-screen keyboard height as the `--kb` CSS variable, so a bottom sheet (`.sheet`) can sit above it.
 *
 * The sheet is `position: fixed; bottom: var(--kb)`. With `adjustResize` the WebView shrinks and the layout viewport
 * already ends above the keyboard, so `--kb` must stay 0 or the sheet would be pushed up twice. `innerHeight` (the
 * layout viewport) shrinking while the visual viewport does not is exactly that case. With `adjustPan`/`adjustNothing`
 * the layout viewport keeps its full height and only the visual viewport (or the focused element's rect) shrinks;
 * there the difference is the keyboard height the sheet has to clear.
 */
export function watchKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement;
  let layoutBase = window.innerHeight; // the tallest layout viewport seen: the no-keyboard height
  const apply = () => {
    const layout = window.innerHeight;
    if (layout >= layoutBase) layoutBase = layout;
    // a pinch-zoomed page also shrinks the visual viewport; only a real keyboard opens a sheet
    const kb = vv.scale === 1 && layout >= layoutBase - 2 ? Math.round(layoutBase - vv.height) : 0;
    root.style.setProperty('--kb', kb > 120 ? `${kb}px` : '0px');
  };
  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
    root.style.removeProperty('--kb');
  };
}

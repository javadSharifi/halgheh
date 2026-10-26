// Line icons used by the design (24x24 grid, stroke = currentColor). The strings are static markup copied from the design boards.
const PATHS = {
  checkCircle: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"m8.5 12 2.5 2.5 4.5-5\"></path>",
  check: "<path d=\"M20 6 9 17l-5-5\"></path>",
  chevronDown: "<path d=\"m6 9 6 6 6-6\"></path>",
  search: "<circle cx=\"11\" cy=\"11\" r=\"7.5\"></circle><path d=\"m20.5 20.5-4.2-4.2\"></path>",
  gift: "<rect x=\"3\" y=\"8\" width=\"18\" height=\"4\" rx=\"1\"></rect><path d=\"M12 8v13\"></path><path d=\"M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7\"></path><path d=\"M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5\"></path>",
  toolbox: "<path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a2 2 0 0 0 3 3l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.3-.6-.6-2.3z\"></path>",
  target: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  chevronRight: "<path d=\"m9 18 6-6-6-6\"></path>",
  chevronLeft: "<path d=\"m15 18-6-6 6-6\"></path>",
  listChecks: "<path d=\"m3 17 2 2 4-4\"></path><path d=\"m3 7 2 2 4-4\"></path><path d=\"M13 6h8\"></path><path d=\"M13 12h8\"></path><path d=\"M13 18h8\"></path>",
  note: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 2v6h6\"></path><path d=\"M16 13H8\"></path><path d=\"M16 17H8\"></path>",
  cake: "<path d=\"M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8\"></path><path d=\"M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1\"></path><path d=\"M2 21h20\"></path><path d=\"M7 8v3\"></path><path d=\"M12 8v3\"></path><path d=\"M17 8v3\"></path>",
  cloudCheck: "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\"></path><path d=\"m9.5 14 2 2 3.5-3.5\"></path>",
  repeat: "<path d=\"m17 2 4 4-4 4\"></path><path d=\"M3 11v-1a4 4 0 0 1 4-4h14\"></path><path d=\"m7 22-4-4 4-4\"></path><path d=\"M21 13v1a4 4 0 0 1-4 4H3\"></path>",
  moreHorizontal: "<path d=\"M6 12h.01\"></path><path d=\"M12 12h.01\"></path><path d=\"M18 12h.01\"></path>",
  plus: "<path d=\"M12 5v14\"></path><path d=\"M5 12h14\"></path>",
  home: "<path d=\"M3 10.5 12 3l9 7.5\"></path><path d=\"M5 9v10.5a1.5 1.5 0 0 0 1.5 1.5H10v-6h4v6h3.5a1.5 1.5 0 0 0 1.5-1.5V9\"></path>",
  calendarDays: "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16.5\" rx=\"3\"></rect><path d=\"M16 2.5v4\"></path><path d=\"M8 2.5v4\"></path><path d=\"M3 10h18\"></path><path d=\"M8 14h.01\"></path><path d=\"M12 14h.01\"></path><path d=\"M16 14h.01\"></path><path d=\"M8 17.5h.01\"></path><path d=\"M12 17.5h.01\"></path>",
  cakeCandles: "<path d=\"M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8\"></path><path d=\"M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1\"></path><path d=\"M2 21h20\"></path><path d=\"M7 8v3\"></path><path d=\"M12 8v3\"></path><path d=\"M17 8v3\"></path><path d=\"M7 4h.01\"></path><path d=\"M12 4h.01\"></path><path d=\"M17 4h.01\"></path>",
  moreCircle: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8 12h.01\"></path><path d=\"M12 12h.01\"></path><path d=\"M16 12h.01\"></path>",
  calendar: "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16.5\" rx=\"3\"></rect><path d=\"M16 2.5v4\"></path><path d=\"M8 2.5v4\"></path><path d=\"M3 10h18\"></path>",
  bell: "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"></path>",
  pin: "<path d=\"M12 17v5\"></path><path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\"></path>",
  tag: "<path d=\"M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z\"></path><circle cx=\"7.5\" cy=\"7.5\" r=\"1\"></circle>",
  clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 7v5l3 2\"></path>",
  info: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 16v-4\"></path><path d=\"M12 8h.01\"></path>",
  close: "<path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path>",
  history: "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path><path d=\"M12 7v5l4 2\"></path>",
  moon: "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"></path>",
  alignLeft: "<path d=\"M3 6h18\"></path><path d=\"M3 12h12\"></path><path d=\"M3 18h6\"></path>",
  sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2\"></path><path d=\"M12 20v2\"></path><path d=\"m4.93 4.93 1.41 1.41\"></path><path d=\"m17.66 17.66 1.41 1.41\"></path><path d=\"M2 12h2\"></path><path d=\"M20 12h2\"></path><path d=\"m6.34 17.66-1.41 1.41\"></path><path d=\"m19.07 4.93-1.41 1.41\"></path>",
  contrast: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 3v18\"></path><path d=\"M12 3a9 9 0 0 1 0 18\" fill=\"currentColor\"></path>",
  phone: "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"3\"></rect><path d=\"M9 6h6\"></path>",
  refresh: "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"></path><path d=\"M21 3v5h-5\"></path><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"></path><path d=\"M8 16H3v5\"></path>",
  download: "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><path d=\"m7 10 5 5 5-5\"></path><path d=\"M12 15V3\"></path>",
  upload: "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M12 3v12\"></path>",
  lock: "<rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2.5\"></rect><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"></path>",
  smartphone: "<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"3\"></rect><path d=\"M11 18h2\"></path>",
  cloudOff: "<path d=\"m2 2 20 20\"></path><path d=\"M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2\"></path><path d=\"M21.53 16.1A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10.2 5.06\"></path>",
  database: "<ellipse cx=\"12\" cy=\"5\" rx=\"8\" ry=\"3\"></ellipse><path d=\"M4 5v14a8 3 0 0 0 16 0V5\"></path><path d=\"M4 12a8 3 0 0 0 16 0\"></path>",
  file: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 2v6h6\"></path><path d=\"M16 13H8\"></path>",
  settings: "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  trash: "<path d=\"M3 6h18\"></path><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"></path><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path><path d=\"M10 11v6\"></path><path d=\"M14 11v6\"></path>",
  undo: "<path d=\"M9 14 4 9l5-5\"></path><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"></path>",
  wifiOff: "<path d=\"M12 20h.01\"></path><path d=\"M8.5 16.43a5 5 0 0 1 7 0\"></path><path d=\"M5 12.86a10 10 0 0 1 5.17-2.69\"></path><path d=\"M19 12.86a10 10 0 0 0-2.01-1.53\"></path><path d=\"M2 8.82a15 15 0 0 1 4.18-2.65\"></path><path d=\"M22 8.82a15 15 0 0 0-11.29-3.76\"></path><path d=\"m2 2 20 20\"></path>",
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export function Icon({ name, size = 20, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}

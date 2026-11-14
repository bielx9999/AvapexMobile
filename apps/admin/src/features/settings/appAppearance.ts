export const fontFamilies = [
  { value: 'inter', label: 'Inter' },
  { value: 'arial', label: 'Arial' },
  { value: 'georgia', label: 'Georgia' },
] as const;

export const fontScales = [90, 100, 110, 120, 130] as const;
export type AppFontFamily = (typeof fontFamilies)[number]['value'];
export type AppFontScale = (typeof fontScales)[number];

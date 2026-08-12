// Design tokens matching the "Cem SEO" Figma prototype
// (dark navy background, purple→blue gradient accent, warm off-white ink text)

export const colors = {
  bg: "#0B0C14",
  card: "#161826",
  cardBorder: "#292C38",
  purple: "#676AF6",
  blue: "#517EEE",
  ink: "#E3E1D6", // matured off-white, not pure white
  textMuted: "#94989F",
  green: "#5ED68C",
  amber: "#F2A640",
  red: "#F06666",
  white: "#FFFFFF",
};

export const gradient = [colors.purple, colors.blue] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: "700" as const },
  h2: { fontSize: 20, fontWeight: "700" as const },
  h3: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  bodyMedium: { fontSize: 13, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  statValue: { fontSize: 22, fontWeight: "700" as const },
};

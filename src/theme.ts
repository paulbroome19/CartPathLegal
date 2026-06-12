export const colors = {
  pine:      '#023C2A',
  linen:     '#F6F2E9',
  surface:   '#FFFFFF',
  ink:       '#16241D',
  muted:     '#6B7A70',
  brass:     '#B8902E',
  brassMuted:'#A99868',
  brassText: '#2E2305',
  stone:     '#EBE4D5',
  hairline:  '#E4DECF',
  sage:      '#C2CFC4',
  burgundy:  '#7A2E2E',
  ease: {
    easy: '#1E6B45', // ≤ 45 min
    mid:  '#C2952F', // 46–75 min
    far:  '#B0573A', // > 75 min
  },
  access: {
    members:  { bg: '#6B2737', fg: '#F3E4E7', border: undefined as string | undefined },
    open:     { bg: '#DCE8DE', fg: '#0A4733', border: undefined as string | undefined },
    visitors: { bg: 'transparent', fg: '#0A4733', border: '#B7C6BC' },
  },
};

export const radius = { md: 8, lg: 12, pill: 999 };
export const space  = { xs: 6, sm: 8, md: 12, lg: 16, xl: 24 };
export const font   = {
  serif:     'Fraunces_500Medium',
  serifBold: 'Fraunces_600SemiBold',
  sans:      'Inter_400Regular',
  sansMed:   'Inter_500Medium',
  sansBold:  'Inter_600SemiBold',
};

export const typeScale = {
  display: {
    fontFamily: font.serifBold,
    fontSize: 32 as const,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: font.serifBold,
    fontSize: 26 as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: font.serif,
    fontSize: 20 as const,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: font.sans,
    fontSize: 16 as const,
  },
  bodyStrong: {
    fontFamily: font.sansBold,
    fontSize: 16 as const,
  },
  label: {
    fontFamily: font.sansBold,
    fontSize: 12 as const,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: font.sans,
    fontSize: 13 as const,
    color: colors.muted,
  },
  tabular: {
    fontFamily: font.sansBold,
    fontVariant: ['tabular-nums' as const],
  },
};

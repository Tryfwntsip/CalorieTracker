/**
 * Semantic color tokens, one set per scheme. Components consume ONLY these
 * semantic names (never raw hex), so both themes stay in sync by design.
 * Direction: calm, minimal, warm-neutral surfaces with a green-teal accent.
 */
export type SemanticColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
  skeleton: string;
};

export const lightColors: SemanticColors = {
  background: '#F7F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#EEEEE8',
  textPrimary: '#1C1D1A',
  textSecondary: '#65675F',
  textDisabled: '#A3A59C',
  border: '#E2E3DB',
  primary: '#2E7D67',
  onPrimary: '#FFFFFF',
  primarySoft: '#DEEFE9',
  success: '#3E8E5A',
  successSoft: '#E1F1E6',
  warning: '#A97612',
  warningSoft: '#F7ECD3',
  danger: '#BC4326',
  dangerSoft: '#F9E2DB',
  overlay: 'rgba(20, 22, 20, 0.45)',
  skeleton: '#E7E7E0',
};

export const darkColors: SemanticColors = {
  background: '#141614',
  surface: '#1D201D',
  surfaceAlt: '#272B27',
  textPrimary: '#F1F2ED',
  textSecondary: '#A7AAA1',
  textDisabled: '#6C6F66',
  border: '#343831',
  primary: '#5FBEA2',
  onPrimary: '#0D2A22',
  primarySoft: '#1E332C',
  success: '#6FBF8A',
  successSoft: '#213525',
  warning: '#D9A44A',
  warningSoft: '#383021',
  danger: '#E17258',
  dangerSoft: '#3B241D',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#2B2F2B',
};

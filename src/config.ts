/**
 * Project identity shown on the opening dashboard.
 * Edit the defaults here, or override any field at build time with environment variables
 * (e.g. VITE_APP_ID=DSA-2026-042 in a .env file or in Vercel's project settings).
 */
const env = import.meta.env;

export const APP_CONFIG = {
  appName: env.VITE_APP_NAME || 'DSA Visual Lab',
  appId: env.VITE_APP_ID || '2409038',
  projectTitle: env.VITE_PROJECT_TITLE || 'Interactive Algorithm Visualisation Suite',
  author: env.VITE_AUTHOR || 'Antriksha Jain',
  institution: env.VITE_INSTITUTION || 'Atlas SkillTech University',
  course: env.VITE_COURSE || 'B.Tech in AI, ML & Computer Science',
  /** Leave empty to hide the row on the dashboard. */
  rollNumber: env.VITE_ROLL_NUMBER || '',
  version: '1.0.0',
  year: env.VITE_YEAR || '2026',
};

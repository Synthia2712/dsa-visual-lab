/**
 * Project identity shown on the opening dashboard.
 * Edit the defaults here, or override any field at build time with environment variables
 * (e.g. VITE_APP_ID=DSA-2026-042 in a .env file or in Vercel's project settings).
 */
const env = import.meta.env;

export const APP_CONFIG = {
  appName: env.VITE_APP_NAME || 'DSA Visual Lab',
  appId: env.VITE_APP_ID || 'APP-ID-0000',
  projectTitle: env.VITE_PROJECT_TITLE || 'Interactive Algorithm Visualisation Suite',
  author: env.VITE_AUTHOR || 'Your Name',
  institution: env.VITE_INSTITUTION || 'Your Institution',
  course: env.VITE_COURSE || 'Data Structures & Algorithms',
  rollNumber: env.VITE_ROLL_NUMBER || 'Roll No. —',
  version: '1.0.0',
  year: env.VITE_YEAR || '2026',
};

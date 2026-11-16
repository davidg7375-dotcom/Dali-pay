// מוסיף את google-services.json (Firebase) רק אם הקובץ קיים. ה-workflow יוצר אותו מה-Secret GOOGLE_SERVICES_JSON.
// בלעדיו האפליקציה נבנית ועובדת כרגיל, רק בלי התראות Push.
const fs = require('fs');

module.exports = ({ config }) => {
  const android = { ...(config.android || {}) };
  if (fs.existsSync('./google-services.json')) android.googleServicesFile = './google-services.json';
  return { ...config, android };
};

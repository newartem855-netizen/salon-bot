const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function appendRow(data) {
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const now = new Date().toLocaleDateString('ru-RU');

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:G',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        now,
        data.clientName,
        data.clientPhone,
        data.serviceName || '',
        data.masterName || '',
        data.date,
        data.time,
      ]],
    },
  });
}

module.exports = { appendRow };
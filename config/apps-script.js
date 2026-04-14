// Paste this into: Google Sheet → Extensions → Apps Script

const API_URL = 'https://reel.darkhelmettechnologies.com';
const API_SECRET = 'reel-machine-test-secret-2026';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Reel Machine')
    .addItem('Generate scenarios', 'generateScenarios')
    .addItem('Poll status', 'pollSheets')
    .addToUi();
}

function generateScenarios() {
  const ui = SpreadsheetApp.getUi();
  try {
    const response = UrlFetchApp.fetch(API_URL + '/api/generate-scenarios', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + API_SECRET,
      },
      contentType: 'application/json',
      muteHttpExceptions: true,
    });
    const result = JSON.parse(response.getContentText());
    if (result.success) {
      ui.alert('Generated ' + result.count + ' scenarios:\n\n' + result.titles.join('\n') + '\n\nCost: $' + (result.cost || 0).toFixed(4));
    } else {
      ui.alert('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    ui.alert('Connection error: ' + e.message);
  }
}

function pollSheets() {
  const ui = SpreadsheetApp.getUi();
  try {
    const response = UrlFetchApp.fetch(API_URL + '/api/poll-sheets', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + API_SECRET,
      },
      muteHttpExceptions: true,
    });
    const result = JSON.parse(response.getContentText());
    if (result.success) {
      ui.alert('Total scenarios: ' + result.totalScenarios + '\n\n' + result.actions.join('\n'));
    } else {
      ui.alert('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    ui.alert('Connection error: ' + e.message);
  }
}

/**
 * Google Apps Script for Dov's Image Catalog
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to script.google.com
 * 2. Create a new project
 * 3. Paste this entire code
 * 4. Update the CONFIG values below with your folder ID
 * 5. Run the 'generateJSON' function once manually to authorize
 * 6. Set up a trigger: Edit > Triggers > Add Trigger
 *    - Function: generateJSON
 *    - Event source: Time-driven
 *    - Type: Minutes timer
 *    - Interval: Every 5 minutes
 */

// UPDATE THESE VALUES
const CONFIG = {
  FOLDER_ID: '1rzlu8tGtnTKz0Xi0vw92hlKVU3Gm2tYF', // Your DovArt folder ID
  EXCEL_FILENAME: 'Description and themes of my images.xlsx',
  OUTPUT_FILENAME: 'image-data.json'
};

function generateJSON() {
  try {
    // Get the folder
    const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);

    // Find the Excel file
    const files = folder.getFilesByName(CONFIG.EXCEL_FILENAME);
    if (!files.hasNext()) {
      Logger.log('Excel file not found: ' + CONFIG.EXCEL_FILENAME);
      return;
    }

    const excelFile = files.next();

    // Convert Excel to Google Sheets temporarily to read it
    const blob = excelFile.getBlob();
    const tempSheet = Drive.Files.insert(
      { title: 'temp_conversion', mimeType: MimeType.GOOGLE_SHEETS },
      blob
    );

    const spreadsheet = SpreadsheetApp.openById(tempSheet.id);
    const sheet = spreadsheet.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    // Parse the data
    const images = [];
    const headers = data[0];

    // Find column indices (adjust these based on your Excel structure)
    const nameCol = findColumn(headers, ['Image Name', 'Name', 'name']);
    const descCol = findColumn(headers, ['Image Description', 'Description', 'description']);
    const themesCol = findColumn(headers, ['Themes', 'Theme', 'themes']);
    const dateCol = findColumn(headers, ['Date Created', 'Date', 'Created', 'date created']);

    Logger.log('Columns found - Name: ' + nameCol + ', Desc: ' + descCol + ', Themes: ' + themesCol + ', Date: ' + dateCol);

    // Get list of image files in the folder
    const imageFiles = {};
    const folderFiles = folder.getFiles();
    while (folderFiles.hasNext()) {
      const file = folderFiles.next();
      const fileName = file.getName();
      if (isImageFile(fileName)) {
        const baseName = fileName.replace(/\.[^.]+$/, '');
        imageFiles[baseName] = {
          id: file.getId(),
          name: fileName
        };
      }
    }

    // Process each row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = row[nameCol];

      if (!name || name.toString().trim() === '') continue;

      const nameStr = name.toString().trim();
      const description = descCol >= 0 ? (row[descCol] || '').toString() : '';
      const themesRaw = themesCol >= 0 ? (row[themesCol] || '').toString() : '';

      // Parse date
      let dateCreated = null;
      if (dateCol >= 0 && row[dateCol]) {
        const dateValue = row[dateCol];
        if (dateValue instanceof Date) {
          dateCreated = dateValue.toISOString();
        } else {
          const parsed = new Date(dateValue);
          if (!isNaN(parsed.getTime())) {
            dateCreated = parsed.toISOString();
          }
        }
      }

      // Parse themes (assuming comma or semicolon separated)
      const themes = themesRaw
        .split(/[,;]/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Find matching image file
      const imageInfo = imageFiles[nameStr];

      const imageEntry = {
        name: nameStr,
        description: description,
        themes: themes,
        dateCreated: dateCreated
      };

      if (imageInfo) {
        imageEntry.filename = imageInfo.name;
        imageEntry.fileId = imageInfo.id;
        imageEntry.imageUrl = 'https://drive.google.com/uc?export=view&id=' + imageInfo.id;
      }

      images.push(imageEntry);
    }

    // Delete temp spreadsheet
    DriveApp.getFileById(tempSheet.id).setTrashed(true);

    // Create JSON output
    const output = {
      generated: new Date().toISOString(),
      count: images.length,
      images: images
    };

    const jsonContent = JSON.stringify(output, null, 2);

    // Save or update the JSON file
    const existingFiles = folder.getFilesByName(CONFIG.OUTPUT_FILENAME);
    if (existingFiles.hasNext()) {
      const existingFile = existingFiles.next();
      existingFile.setContent(jsonContent);
      Logger.log('Updated existing JSON file with ' + images.length + ' images');
    } else {
      folder.createFile(CONFIG.OUTPUT_FILENAME, jsonContent, MimeType.PLAIN_TEXT);
      Logger.log('Created new JSON file with ' + images.length + ' images');
    }

    return output;

  } catch (error) {
    Logger.log('Error: ' + error.toString());
    throw error;
  }
}

function findColumn(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toString().toLowerCase().trim();
    for (const name of possibleNames) {
      if (header === name.toLowerCase() || header.includes(name.toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}

function isImageFile(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(ext);
}

// Test function
function testRun() {
  const result = generateJSON();
  Logger.log('Generated ' + result.count + ' image entries');
}

// Check for discrepancies between folder and spreadsheet
function checkDiscrepancies() {
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);

  // Get all image files in folder
  const folderImages = {};
  const duplicatesInFolder = [];
  const folderFiles = folder.getFiles();

  while (folderFiles.hasNext()) {
    const file = folderFiles.next();
    const fileName = file.getName();
    if (isImageFile(fileName)) {
      const baseName = fileName.replace(/\.[^.]+$/, '');
      if (folderImages[baseName]) {
        duplicatesInFolder.push(baseName);
      }
      folderImages[baseName] = fileName;
    }
  }

  // Get all names from spreadsheet
  const files = folder.getFilesByName(CONFIG.EXCEL_FILENAME);
  if (!files.hasNext()) {
    Logger.log('Excel file not found');
    return;
  }

  const excelFile = files.next();
  const blob = excelFile.getBlob();
  const tempSheet = Drive.Files.insert(
    { title: 'temp_check', mimeType: MimeType.GOOGLE_SHEETS },
    blob
  );

  const spreadsheet = SpreadsheetApp.openById(tempSheet.id);
  const sheet = spreadsheet.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameCol = findColumn(headers, ['Image Name', 'Name', 'name']);

  const spreadsheetNames = new Set();
  for (let i = 1; i < data.length; i++) {
    const name = data[i][nameCol];
    if (name && name.toString().trim() !== '') {
      spreadsheetNames.add(name.toString().trim());
    }
  }

  DriveApp.getFileById(tempSheet.id).setTrashed(true);

  // Find images in folder but not in spreadsheet
  const inFolderNotSpreadsheet = [];
  for (const baseName in folderImages) {
    if (!spreadsheetNames.has(baseName)) {
      inFolderNotSpreadsheet.push(folderImages[baseName]);
    }
  }

  // Log results
  Logger.log('========== DISCREPANCY REPORT ==========');
  Logger.log('');
  Logger.log('--- DUPLICATE FILENAMES IN FOLDER ---');
  if (duplicatesInFolder.length > 0) {
    duplicatesInFolder.forEach(name => Logger.log('  ' + name));
  } else {
    Logger.log('  None found');
  }

  Logger.log('');
  Logger.log('--- IMAGES IN FOLDER BUT NOT IN SPREADSHEET ---');
  if (inFolderNotSpreadsheet.length > 0) {
    inFolderNotSpreadsheet.forEach(name => Logger.log('  ' + name));
    Logger.log('  Total: ' + inFolderNotSpreadsheet.length);
  } else {
    Logger.log('  None found');
  }

  Logger.log('');
  Logger.log('--- SUMMARY ---');
  Logger.log('  Total images in folder: ' + Object.keys(folderImages).length);
  Logger.log('  Total entries in spreadsheet: ' + spreadsheetNames.size);
}

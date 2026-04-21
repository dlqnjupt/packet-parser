const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let statsData = { total: 0, records: [] };
const statsFile = path.join(app.getPath('userData'), 'stats.json');

function loadStats() {
  try {
    if (fs.existsSync(statsFile)) {
      statsData = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    }
  } catch (e) {
    console.error('Load stats error:', e);
  }
}

function saveStats() {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(statsData, null, 2));
  } catch (e) {
    console.error('Save stats error:', e);
  }
}

function createWindow() {
  console.log('__dirname:', __dirname);
  console.log('Dist path:', path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'ScaleUp Packet Parser',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');
    console.log('App path:', appPath);
    console.log('Index path:', indexPath);
    mainWindow.loadFile(indexPath);
    // 生产模式不开启开发者工具
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  loadStats();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('parse-stats', (event, data) => {
  statsData.total += 1;
  statsData.records.push({
    ...data,
    timestamp: new Date().toISOString(),
  });
  if (statsData.records.length > 10000) {
    statsData.records = statsData.records.slice(-10000);
  }
  saveStats();
  return { success: true, total: statsData.total };
});

ipcMain.handle('get-stats', () => {
  return statsData;
});

const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const net = require('net');
const fs = require('fs');

let mainWindow;
let backendProcess = null;
let frontendProcess = null;
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;
const isDev = !app.isPackaged;

function getBasePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '..');
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const client = new net.Socket();
      client.connect(port, '127.0.0.1', () => {
        client.destroy();
        clearInterval(interval);
        resolve(true);
      });
      client.on('error', () => {
        client.destroy();
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for port ${port}`));
        }
      });
    }, 500);
  });
}

async function startBackend() {
  const basePath = getBasePath();
  const backendDir = path.join(basePath, 'backend');
  const pythonDir = path.join(backendDir, '.venv', 'Scripts');

  if (!fs.existsSync(backendDir)) {
    console.error('Backend directory not found:', backendDir);
    return;
  }

  const isAvailable = await isPortAvailable(BACKEND_PORT);
  if (!isAvailable) {
    console.log(`Port ${BACKEND_PORT} already in use, assuming backend is running`);
    return;
  }

  console.log('Starting backend...');

  const pythonExe = process.platform === 'win32'
    ? path.join(pythonDir, 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python');

  const args = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)];

  backendProcess = spawn(pythonExe, args, {
    cwd: backendDir,
    stdio: 'pipe',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  backendProcess.stdout?.on('data', (data) => console.log(`[backend] ${data}`));
  backendProcess.stderr?.on('data', (data) => console.error(`[backend] ${data}`));
  backendProcess.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });
}

async function startFrontend() {
  const basePath = getBasePath();
  const frontendDir = path.join(basePath, 'frontend');

  if (!fs.existsSync(frontendDir)) {
    console.error('Frontend directory not found:', frontendDir);
    return;
  }

  const isAvailable = await isPortAvailable(FRONTEND_PORT);
  if (!isAvailable) {
    console.log(`Port ${FRONTEND_PORT} already in use, assuming frontend is running`);
    return;
  }

  console.log('Starting frontend...');

  const npmExe = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['run', 'start'];

  frontendProcess = spawn(npmExe, args, {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(FRONTEND_PORT),
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
    },
  });

  frontendProcess.stdout?.on('data', (data) => console.log(`[frontend] ${data}`));
  frontendProcess.stderr?.on('data', (data) => console.error(`[frontend] ${data}`));
  frontendProcess.on('exit', (code) => {
    console.log(`Frontend exited with code ${code}`);
    frontendProcess = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Nethermind — Network Intelligence',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0e1a',
    show: false,
  });

  mainWindow.loadURL('about:blank');

  mainWindow.once('ready-to-show', async () => {
    try {
      await startBackend();
      await waitForPort(BACKEND_PORT, 30000);

      await startFrontend();
      await waitForPort(FRONTEND_PORT, 60000);

      mainWindow.loadURL(`http://127.0.0.1:${FRONTEND_PORT}`);
      mainWindow.show();
    } catch (err) {
      console.error('Failed to start services:', err);
      dialog.showErrorBox(
        'Startup Error',
        `Failed to start Nethermind services:\n\n${err.message}\n\nPlease ensure Python and Node.js are installed.`
      );
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (frontendProcess) {
    frontendProcess.kill();
    frontendProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (frontendProcess) {
    frontendProcess.kill();
    frontendProcess = null;
  }
});

import { app, Menu, BrowserWindow, Tray, ipcMain, shell } from 'electron';

const fs = require('fs');
const http = require('http');
const url = require('url');
const xml2js = require('xml2js');
const path = require('path');
const dialog = require('electron').dialog;
const serverAddress = '127.0.0.1';
const serverPort = 51235;
const iconPath = './lib/icon.png';
const iconFile = fs.readFileSync(iconPath);
const homePath = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
const openIdeaCommand = 'idea';
const settings = require('electron-settings');

let win;

let mainWindow = null;
let tray = null
let server;
let projectPath;


function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    width: 600,
    height: 600,
    backgroundColor: '#ffffff',
    icon: `file://${__dirname}/lib/logo.png`
  })
  win.loadURL(`file://${__dirname}/lib/index.html`)
  //// uncomment below to open the DevTools.
  // win.webContents.openDevTools()
  // Event when the window is closed.
  win.on('closed', function () {
    win = null;
  });
}
// Create window on electron intialization
  app.on('ready', startServer)
// Quit when all windows are closed.
  app.on('window-all-closed', function () {
    // On macOS specific close process
    if (process.platform !== 'darwin') {
      app.quit();
    }
  })
  app.on('activate', function () {
    // macOS specific close process
    if (win === null) {
      createWindow();
    }
  });

  function startServer() {
    handleSubmission();
    mainWindow = new BrowserWindow({show: false});

    mainWindow.on('closed', function () {
      mainWindow = null;
    });

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Settings', click() {
          openSettings();
        }
      },
      {
        label: 'Close', click() {
          closeApplication();
        }
      }
    ]);
    tray.setToolTip('This is my application.');
    tray.setContextMenu(contextMenu);

    const recentProjectsXmlPaths = getIdeaRecentProjectsFilePaths();
    let lastProjectsXmlPath = recentProjectsXmlPaths[recentProjectsXmlPaths.length - 1];

    console.log('Current xml = ' + lastProjectsXmlPath);
    const hasSetting = settings.has('project.xml');
    console.log('Has Settings = ' + hasSetting);

    if (hasSetting) {
      const loadedProjectXmlPath = settings.get('project.xml');
      if (fs.existsSync(loadedProjectXmlPath) && fs.statSync(loadedProjectXmlPath).isFile()) {
        lastProjectsXmlPath = loadedProjectXmlPath;
      }
    }

    console.log('lastProjectsXmlPath = ' + lastProjectsXmlPath);

    settings.set('project', {
      xml: 'lastProjectsXmlPath',
    });

    console.log('Settings saved');

    this.projectPath = getOpenPath(lastProjectsXmlPath);

    server = createServer(projectPath);
    server.listen(serverPort, serverAddress);
    console.log('Server running at http://' + serverAddress + ':' + serverPort + '/');

    // printDirs();
  }

  function createServer(projectPath) {
    return http.createServer(function (req, res) {
      const request = url.parse(req.url, true);
      const queryReq = request.query;

      if (queryReq.file && queryReq.line) {
        const filePath = projectPath + '\'' + queryReq.file;
        const exec = require('child_process').exec;
        const cmd = openIdeaCommand + ' --line ' + queryReq.line + '\'' + filePath + '\'';
        exec(cmd, function (error, stdout, stderr) {
          console.log(cmd);
        });
      }
      res.writeHead(200, {
        'Content-Type': 'image/gif'
      });
      res.end(iconFile, 'binary');
    });
  }

  function getOpenPath(filePath) {
    if (fs.existsSync(filePath)) {
      let openPath;
      try {
        const fileData = fs.readFileSync(filePath, 'ascii');
        const parser = xml2js.Parser({
          explicitArray: true
        });

        parser.parseString(fileData.substring(0, fileData.length), function (err, result) {
          const json = JSON.stringify(result);
          const configuration = JSON.parse(json);
          const parsedPath = configuration.application.component[0].option[1].list[0].option[0].$.value;
          openPath = parsedPath.replace('$USER_HOME$', homePath);
        });
        console.log('Open path = ' + openPath + ' was successfully read.');
        return openPath;
      } catch (ex) {
        console.log(ex);
      }
    } else {
      console.log(filePath + ' not found');
    }
  }

  function openSettings() {
    createWindow();

    const modalPath = path.join('file://', __dirname, 'settings.html');
    console.log(modalPath);

    win = new BrowserWindow({width: 400, height: 320});
    win.on('closed', () => {
      win = null;
    });
    win.setMenu(null);
    win.loadURL(modalPath);
    win.show();
  }

  function handleSubmission() {
    ipcMain.on('save-settings', (event, argument) => {
      const {xmlPath} = argument;
      const recentProjectsXmlPath = xmlPath;
      this.projectPath = getOpenPath(recentProjectsXmlPath);

      console.log(recentProjectsXmlPath);
    });

    ipcMain.on('restore-defaults', (event, argument) => {
      console.log('restore');
      const ideaRecentProjectsFilePaths = getIdeaRecentProjectsFilePaths().sort();
      const lastRecentProjectsFilePath = ideaRecentProjectsFilePaths[ideaRecentProjectsFilePaths.length - 1];
      event.sender.send('set-recent-project-path', lastRecentProjectsFilePath);
    });

    ipcMain.on('open-folder-page', (event, argument) => {
      const settingUrl = 'https://intellij-support.jetbrains.com/hc/en-us/articles/206544519-Directories-used-by-the-IDE-to-store-settings-caches-plugins-and-logs';
      shell.openExternal(settingUrl);
    });
  }

  function printDirs() {
    getIdeaRecentProjectsFilePaths().forEach(function (file) {
      console.log('%s (%s)', file, path.basename(file));
    });
  }

  function getIdeaRecentProjectsFilePaths() {
    return fs.readdirSync(homePath).map(function (file) {
      return path.join(homePath, file);
    }).filter(function (file) {
      return fs.statSync(file).isDirectory();
    }).filter(function (file) {
      return path.basename(file).startsWith('.IdeaIC') || path.basename(file).startsWith('.IntelliJIdea');
    }).map(function (file) {
      return path.join(file, 'config/options/recentProjects.xml');
    }).filter(function (recentProjectsFilePath) {
      return fs.existsSync(recentProjectsFilePath) && fs.statSync(recentProjectsFilePath).isFile();
    });
  }

  function closeApplication() {
    server.close();
    app.quit();
  }



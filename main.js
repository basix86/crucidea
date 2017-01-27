'use strict';

const electron = require('electron');

const {app, Menu, Tray, BrowserWindow, ipcMain, shell} = require('electron');
var mainWindow = null;
let tray = null

var fs = require('fs');
var http = require('http');
var url = require('url');
var xml2js = require('xml2js');
var path = require('path');
var dialog = require('electron').dialog
var serverAddress = '127.0.0.1';
var serverPort = 51235;
var iconPath = './icon.png';
var iconFile = fs.readFileSync(iconPath);
var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var openIdeaCommand = "idea";
var server;

app.on('ready', function () {


    handleSubmission();
    mainWindow = new BrowserWindow({ show: false });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Settings', click() { openSettings() } },
        { label: 'Close', click() { closeApplication() } }
    ])
    tray.setToolTip('This is my application.');
    tray.setContextMenu(contextMenu);

    let recentProjectsXmlPaths = getIdeaRecentProjectsFilePaths();
    let lastProjectsXmlPath = recentProjectsXmlPaths[recentProjectsXmlPaths.length - 1];
    let projectPath = getOpenPath(lastProjectsXmlPath);

    server = createServer(projectPath);
    server.listen(serverPort, serverAddress);
    console.log('Server running at http://' + serverAddress + ':' + serverPort + '/');

    printDirs(homePath);

});

function createServer(projectPath) {
    return http.createServer(function (req, res) {
        var request = url.parse(req.url, true);
        var queryReq = request.query;

        if (queryReq.file && queryReq.line) {
            let filePath = projectPath + "/" + queryReq.file;
            let exec = require('child_process').exec;
            let cmd = openIdeaCommand + " --line " + queryReq.line + " '" + filePath + "'";
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
        var projectPath;
        try {
            var fileData = fs.readFileSync(filePath, 'ascii');
            var parser = xml2js.Parser({
                explicitArray: true
            });

            parser.parseString(fileData.substring(0, fileData.length), function (err, result) {
                var json = JSON.stringify(result);
                var configuration = JSON.parse(json);
                var parsedPath = configuration.application.component[0].option[1].list[0].option[0].$.value;
                projectPath = parsedPath.replace("$USER_HOME$", homePath);
            });
            console.log("Open path = " + projectPath + " was successfully read.");
            return projectPath;
        } catch (ex) {
            console.log(ex)
        }
    } else console.log(filePath + " not found");
}

function openSettings() {
    const modalPath = path.join('file://', __dirname, 'settings.html');
    console.log(modalPath);

    let win = new BrowserWindow({ width: 400, height: 320 });
    win.on('closed', () => { win = null });
    win.setMenu(null);
    win.loadURL(modalPath)
    win.show()
}

function handleSubmission() {
    ipcMain.on('save-settings', (event, argument) => {
        const { xmlPath } = argument;
        recentProjectsXmlPath = xmlPath;
        projectPath = getOpenPath(recentProjectsXmlPath);

        console.log(recentProjectsXmlPath);
    });

    ipcMain.on('restore-defaults', (event, argument) => {
        console.log("restore");
        var ideaRecentProjectsFilePaths = getIdeaRecentProjectsFilePaths().sort();
        var lastRecentProjectsFilePath = ideaRecentProjectsFilePaths[ideaRecentProjectsFilePaths.length - 1];
        event.sender.send('set-recent-project-path', lastRecentProjectsFilePath);
    });

    ipcMain.on('open-folder-page', (event, argument) => {
        var settingUrl = "https://intellij-support.jetbrains.com/hc/en-us/articles/206544519-Directories-used-by-the-IDE-to-store-settings-caches-plugins-and-logs";
        shell.openExternal(settingUrl);
    });
}

function printDirs(p) {
    getIdeaRecentProjectsFilePaths().forEach(function (file) {
        console.log("%s (%s)", file, path.basename(file));
    });
}

function getIdeaRecentProjectsFilePaths() {
    return fs.readdirSync(homePath).map(function (file) {
        return path.join(homePath, file);
    }).filter(function (file) {
        return fs.statSync(file).isDirectory();
    }).filter(function (file) {
        return path.basename(file).startsWith(".IdeaIC");
    }).map(function (file) {
        return path.join(file, "config/options/recentProjects.xml");
    }).filter(function (recentProjectsFilePath) {
        return fs.existsSync(recentProjectsFilePath) && fs.statSync(recentProjectsFilePath).isFile();
    });
}

function closeApplication() {
    server.close();
    app.quit();
}

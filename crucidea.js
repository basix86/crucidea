var fs = require('fs');
var http = require('http');
var url = require('url');

var serverPort = 51235;
var img = fs.readFileSync('./icon.png');

var recentProjectsXmlPath = "/home/mmatessi/.IdeaIC2016.2/config/options/recentProjects.xml";
var projectPath = getOpenPath(recentProjectsXmlPath);
var openIdeaCommand = "idea";

var homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

var server = http.createServer(function(req, res) {
    var request = url.parse(req.url, true);
    var queryReq = request.query;

    if (queryReq.file && queryReq.line ) {
        filePath = projectPath + "/" + queryReq.file;           
        exec = require('child_process').exec;
        cmd = openIdeaCommand + " --line " + queryReq.line + " "  + filePath;
        exec(cmd, function(error, stdout, stderr) {
            console.log(cmd);
        });
    }

    res.writeHead(200, {
        'Content-Type': 'image/gif'
    });
    res.end(img, 'binary');
});

server.listen(serverPort, '127.0.0.1');

console.log('Server running at http://127.0.0.1:' + serverPort + '/');


function getOpenPath(filePath) {
    xml2js = require('xml2js');
    var projectPath;
    try {
        fileData = fs.readFileSync(filePath, 'ascii');
        parser = xml2js.Parser({
            explicitArray: true
        });
        parser.parseString(fileData.substring(0, fileData.length), function(err, result) {
            json = JSON.stringify(result);
            configuration = JSON.parse(json);
            parsedPath = configuration.application.component[0].option[1].list[0].option[0].$.value;
            projectPath = parsedPath.replace("$USER_HOME$", "~");
        });
        console.log("Open path = " + projectPath + " was successfully read.\n");
        return projectPath;
    } catch (ex) {
        console.log(ex)
    }
}

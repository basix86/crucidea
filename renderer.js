const { ipcRenderer, remote, shell } = require('electron');
const { dialog } = remote;

const openFileButton = document.getElementById('openFileButton');
const destinationInput = document.getElementById('destinationInput');

openFileButton.addEventListener('click', () => {
    const file = dialog.showOpenDialog({
        properties: [
            'openFile'
        ],
    });
    if (file) {
        destinationInput.value = file;
    }
});

saveButton.addEventListener('click', (event) => {
    event.preventDefault();
    ipcRenderer.send('save-settings', {
        xmlPath: destinationInput.value
    });
});

restoreDefaultButton.addEventListener('click', (event) => {
    event.preventDefault();
    ipcRenderer.send('restore-defaults');
});

ideaFoldersPageLink.addEventListener('click', (event) => {
    event.preventDefault();
    ipcRenderer.send('open-folder-page');
});

ipcRenderer.on('set-recent-project-path', (event, path) => {
     alert(path);
});

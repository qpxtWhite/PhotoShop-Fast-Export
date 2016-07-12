#target photoshop
app.bringToFront();


/*** UTILTIES ***/
String.prototype.trim = function(){
    return this.replace(/^ */, "").replace(/ *$/, "");
}

function keys(obj){
    var keys = [];
    for(i in obj) if (obj.hasOwnProperty(i))
    {
        keys.push(i);
    }
    return keys;
};

function clone(obj){
    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = {}; // changed, obj.constructor()

    for(var key in obj)
        temp[key] = clone(obj[key]);
    return temp;
}

Array.prototype.indexOf = function(el) {
    for (var i = 0; i < this.length; i += 1) {
        if (this[i] == el) return i;
    }
    return -1;
};

Array.prototype.lastIndexOf = function(el) {
    for (var i = this.length-1; i >= 0; i -= 1) {
        if (this[i] == el) return i;
    }
    return -1;
};

Array.prototype.distinct = function() {
    var derivedArray = [];
    for (var i = 0; i < this.length; i += 1) {
        if (derivedArray.indexOf(this[i]) == -1) {
            derivedArray.push(this[i])
        }
    }
    return derivedArray;
};

Array.prototype.each = function(callback) {
    var derivedArray = [];
    for (var i = 0; i < this.length; i += 1) {
        derivedArray.push(callback(this[i], i));
    }
    return derivedArray;
};

function loadResource(file)
{
    var rsrcString;
    if (! file.exists) {
        alert("Resource file '" + file.name + "' for the export dialog is missing! Please, download the rest of the files that come with this script.", "Error", true);
        return false;
    }
    try {
        file.open("r");
        if (file.error) throw file.error;
        rsrcString = file.read();
        if (file.error) throw file.error;
        if (! file.close()) {
            throw file.error;
        }
    }
    catch (error) {
        alert("Failed to read the resource file '" + file.name + "'!\n\nReason: " + error + "\n\nPlease, check it's available for reading and redownload it in case it became corrupted.", "Error", true);
        return false;
    }

    return rsrcString;
}

function makeValidFileName(fileName, replaceSpaces)
{
    var validName = fileName.replace(/^\s+|\s+$/gm, '');	// trim spaces
    validName = validName.replace(/[\\\*\/\?:"\|<>]/g, ''); // remove characters not allowed in a file name
    if (replaceSpaces) {
        validName = validName.replace(/[ ]/g, '_');			// replace spaces with underscores, since some programs still may have troubles with them
    }
    return validName;
}


/*** 定义变量 ***/
var scriptFileDirectory,
    fileNameReg,
    doc,
    docCopy,
    USER_SETTINGS_ID = "FastExportWithOptions",
    SETTING_KEY = {},
    DEFAULT_SETTING = {}



function showOptionsDialog(){
    var rsrcFile = new File(scriptFileDirectory + "/dialog.json");
    var rsrcString = loadResource(rsrcFile);
    if (! rsrcString) {
        throw new Error('dialog.json错误')
    }
    var dlg = new Window(rsrcString);
    var setting = getSetting();
    with (dlg.funcArea) {
        content.grpDest.btnDest.onClick = function(){
            var newFilePath = Folder.selectDialog("Select destination folder", setting.filePath);
            if (newFilePath) {
                content.grpDest.txtDest.text = newFilePath.fsName;
            }
        }
        content.grpDest.txtDest.text = setting.filePath;

        content.pnlOptions.jpgQuality.quality.onChanging = function(){
            this.value = Math.round(this.value);
            content.pnlOptions.jpgQuality.qualityValue.text = this.value;
        }
        content.pnlOptions.jpgQuality.quality.value = setting.jpgQuality;
        content.pnlOptions.jpgQuality.qualityValue.text = setting.jpgQuality;
        
        buttons.btnCancel.onClick = function(){
            dlg.close(0);
        }
        buttons.btnSettings.onClick = function(){
            saveSetting(dlg);
            dlg.close(0);
        }
        buttons.btnRun.onClick = function(){
            saveSetting(dlg);
            dlg.close(1);
        }
    }
    dlg.center();
    return dlg.show();
}

function main(){
    /*** 初始化变量 ***/
    scriptFileDirectory = new File($.fileName).parent;
    doc = app.activeDocument;
    fileNameReg = /(\.jpg|\.png)$/g;
    SETTING_KEY = {
        filePath: app.stringIDToTypeID("destFolder"),
        jpgQuality: app.stringIDToTypeID("jpgQuality")
    };
    DEFAULT_SETTING = {
        filePath: app.activeDocument.path.fsName,
        jpgQuality: 10
    };
    if(showOptionsDialog()){
        docCopy = app.activeDocument.duplicate();
        doc = app.activeDocument;
        var num = executeScript();
        doc.close(SaveOptions.DONOTSAVECHANGES);
        docCopy = null;
        alert('saved '+ num +' files')
    }
}

function executeScript(){
    var layers = collectLayers(doc, 0);
    layers.each(function(layer, ix){
        exportLayer(layer);
    })
    return layers.length;
}

function exportLayer(layer){
    makeVisible(layer);
    doc.trim(TrimType.TRANSPARENT);
    saveImage(layer);
    doc.activeHistoryState = doc.historyStates[doc.historyStates.length-2];
    layer.visible = false;
}

function makeVisible(layer){
    layer.visible = true;
    var current = layer.parent;
    while(current){
        current.visible = true;
        current = current.parent;
    }
}

function saveImage(layer){
    var setting = getSetting();
    var name = makeValidFileName(layer.name.replace(fileNameReg, ''));
    var format = layer.name.match(fileNameReg)[0];
    name = name+format;
    var exportOptions = getExportOptions(layer);
    var saveFile = File(setting.filePath + '/' + name);

    doc.exportDocument(saveFile, ExportType.SAVEFORWEB, exportOptions)
}

function getExportOptions(layer){
    var setting = getSetting();
    var options = new ExportOptionsSaveForWeb();
    var format = layer.name.match(fileNameReg)[0];
    switch(format){
        case '.png':
            options.format = SaveDocumentType.PNG;
            options.quality = 100;
            options.PNG8 = false;
            break;
        case '.jpg':
            options.format = SaveDocumentType.JPEG;
            options.quality = Number(setting.jpgQuality) * 10;
            break;
    }
    return options;
}

function collectLayers(parentLayer, ix){
    var layerDatas = [];
    for(var i=0, l=parentLayer.layers.length; i<l; i++){
        var layer = parentLayer.layers[i];
        if(layer.layers && layer.layers.length>0){
            var childLayers = collectLayers(layer, ix+1);
            layerDatas = layerDatas.concat(childLayers);
        } else {
            layer.visible = false;
            if(fileNameReg.test(layer.name)){
                layerDatas.push(layer);
            }
        }
    }
    return layerDatas;
}

function saveSetting(dlg){
    var desc = new ActionDescriptor();
    with(dlg.funcArea){
        desc.putString(SETTING_KEY.filePath, content.grpDest.txtDest.text);
        desc.putInteger(SETTING_KEY.jpgQuality, content.pnlOptions.jpgQuality.quality.value);
    }
    app.putCustomOptions(USER_SETTINGS_ID, desc, true);
}

function getSetting(){
    var setting = DEFAULT_SETTING;
    try{
        var desc = app.getCustomOptions(USER_SETTINGS_ID);
        setting.filePath = desc.getString(SETTING_KEY.filePath);
        setting.jpgQuality = desc.getInteger(SETTING_KEY.jpgQuality);

    } catch(e){

    }
    return setting;
}

function bootstrap(){
    function showError(err) {
        alert(err + ': on line ' + err.line, 'Script Error', true);
    }
    try{
        main();
    } catch(e){
        showError(e);
    }
}

bootstrap();
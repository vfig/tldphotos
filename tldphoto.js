const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const photoList = document.getElementById("photoList");

var TLDPhotoFileOptions = {
    checkFileName: false,
};

const TLDPhotoFileWrongNameError = "TLDPhotoFileWrongNameError";
//const TLDPhotoFileWrongNameError = "TLDPhotoFileWrongNameError";

class TLDPhotoFile {
    constructor(file) {
        // Assume invalid in all aspects until verified.
        this.file = null;
        this.error = null;
        this.processed = false;
        this.isCompressed = null;
        this.data = {};

        if (TLDPhotoFileOptions.checkFileName) {
            if (file.name !== "photo1") {
                this.error = TLDPhotoFileWrongNameError;
                return;
            }
        }

        this.file = file;
    }
}

function doProcessPhotoFile(photoFile) {
    if (photoFile.error !== null) { console.log("already had error",photoFile.error); return Promise.resolve(photoFile); }
    if (photoFile.processed !== false) { console.log("already processed"); return Promise.resolve(photoFile); }

    return photoFile.file.arrayBuffer()
        .then(function(buf) {
            var bytes = new Uint8Array(buf);
            var data = null;
            var isCompressed;

            // Accept raw JSON first; if it doesn't parse, assume it is compressed.
            try {
                data = JSON.parse(bytes);
                isCompressed = false;
            } catch (e) {
                // Not JSON; ignore the error for now.
            }

            // Otherwise, decompress and then parse, throwing errors this time.
            if (data === null) {
                // TODO: catch errors out of here.
                console.log("decompressing?");
                var decompressedBytes = decompressLZF(bytes);
                var decompressedString = new TextDecoder().decode(decompressedBytes);
                data = JSON.parse(decompressedString);
                isCompressed = true;
            }

            photoFile.data = data;
            photoFile.processed = true;
            photoFile.isCompressed = false;
            photoFile.file = null;
            return photoFile;
        })
        .catch(function(e) {
            photoFile.error = e;
            return photoFile;
        });
}

function decompressLZF(input) {
    var inSize = input.length;
    var outSize = 0;
    // TODO: what if this isnt big enough?
    var outputBuffer = new ArrayBuffer(2*inSize);
    var output = new Uint8Array(outputBuffer);
    var inp = 0;
    var out = 0;
    var b = 0, delta = 0, count = 0;

    while (inp<inSize) {
        b = input[inp]; ++inp;
        if (b < 0x20) {
            // Literal bytes
            count = b+1;
            for (var i=0; i<count; ++i) {
                b = input[inp]; ++inp;
                output[out] = b; ++out;
            }
        } else {
            // Backreference
            count = (b>>5);
            delta = ((b&0x1f)<<8);
            if (count==7) {
                b = input[inp]; ++inp;
                count += b;
            }
            count += 2;
            b = input[inp]; ++inp;
            delta += b+1;
            offset = out-delta;
            for (var i=0; i<count; ++i) {
                output[out] = output[offset]; ++out;
                ++offset;
            }
        }
    }
    outSize = out;
    outputBuffer = outputBuffer.transfer(outSize);
    return new Uint8Array(outputBuffer);
}

function fillPhotoList(photoFile) {
    while (photoList.firstChild)
        photoList.removeChild(photoList.firstChild);

    if (photoFile.error) {
        // TODO: better error handling.
        console.log("ERROR:",photoFile.error);
        return;
    }

    for (var num in photoFile.data) {
        // keys: ['m_AssociatedSave', 'm_JpegData', 'm_Width', 'm_Height', 'm_TextureFormat']
        var entry = photoFile.data[num]
        //assert(entry['m_TextureFormat']=='RGB24')
        //assert(entry['m_Width']==512)
        //assert(entry['m_Height']==512)
        var save = entry['m_AssociatedSave'];
        var filename = "photo_"+save+"_"+num+".jpg";
        var encoded = entry['m_JpegData'];
        var url = "data:image/jpeg;base64,"+encoded;

        //var file = new File(Uint8Array.fromBase64(encoded), filename, {type: 'image/jpeg'});

        var img = document.createElement("img");

        // img.src = URL.createObjectURL(file);
        img.src = url;
        photoList.appendChild(img);
    }
}

function cancelWindowFileDragover(e) {
    for (var item of e.dataTransfer.items) {
        if (item.kind === "file") {
            e.preventDefault();
            if (! dropZone.contains(e.target)) {
                e.dataTransfer.dropEffect = "none";
                dropZone.classList.remove('dragover');
            }
            return;
        }        
    }
}

function cancelWindowFileDrop(e) {
    for (var item of e.dataTransfer.items) {
        if (item.kind === "file") {
            e.preventDefault();
            return;
        }
    }
}

function handleDropZoneDragover(e) {
    for (var item of e.dataTransfer.items) {
        if (item.kind === "file") {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            dropZone.classList.add('dragover');
        }
    }
}

function handleDropZoneDrop(e) {
    e.preventDefault();
    for (var item of e.dataTransfer.items) {
        if (item.kind === "file") {
            dropZone.classList.remove('dragover');
            dropZone.classList.add('dropped');

            var file = item.getAsFile();
            console.log(item, file);

            doProcessPhotoFile(new TLDPhotoFile(file))
                .then(fillPhotoList);
        }
    }
}

function handleFileInputChange(e) {
    e.preventDefault();
    for (var file of e.target.files) {
        dropZone.classList.add('dropped');

        console.log(file);
        doProcessPhotoFile(new TLDPhotoFile(file))
            .then(fillPhotoList);
    }
}

window.addEventListener("dragover", cancelWindowFileDragover);
window.addEventListener("drop", cancelWindowFileDrop);
dropZone.addEventListener("dragover", handleDropZoneDragover);
dropZone.addEventListener("drop", handleDropZoneDrop);
fileInput.addEventListener("change", handleFileInputChange);

/*
  Licensed under the MIT Licesnse.
  Source code is part of Trophier
  Repository is at https://github.com/polar-bear/trophier
  Made by polar-bear
*/

var fs = require("fs"), xml2js = require("xml2js"), path = require("path");

var Trophy = function(buf, callback) {
  if(typeof buf == "undefined") {
    throw new Error("Expected Argument#0 to be either a string or a buffer!");
  } else if(typeof buf == "string") {
    buf = fs.readFileSync(buf);
  } if(!Buffer.isBuffer(buf)) {
    throw new Error("Argument#0 is not a buffer or a string!");
  }

  this.buffer = buf;
  this.trophies = [];
  this.title = "";
  this.detail = "";
  this.version = "01.00";
  this.npcommid = "NP$$#####_00";

  this._magic = 0;
  this._version = 1;
  this._filesz = 0;
  this._files = 0;
  this._elementsz = 0;
  this._sha = [];
  this._filemap = {};

  this._callback = callback;

  this.done = false;

  this.load();
}

Trophy.prototype = {
  toString: function() {
    return "[Trophy#"+this.npcommid+"]";
  },
  destroy: function() {
    for(var name in this._filemap) {
      delete this._filemap[name];
    }
    while(this._sha.length) this._sha.shift();
    while(this.trophies.length) this.trophies.shift();
    this.buffer = new Buffer();
    return;
  },
  icon: function() {
    if(typeof this._filemap["ICON0.PNG"] == "undefined") return "";
    return "data:image/png;base64,"+this._filemap["ICON0.PNG"].toString("base64");
  },
  load: function() {
    this._magic = this.buffer.readUInt32BE(0);
    this._version = this.buffer.readUInt32BE(4);
    // this._filesz = this.buffer.readUInt64BE(8); //Javascript has no 64-bit numbers
    this._filesz = this.buffer.readUInt32BE(12);
    this._files = this.buffer.readUInt32BE(16);
    this._elementsz = this.buffer.readUInt32BE(20);
    //this._unknown = this.buffer.readUInt32BE(24);
    var pos = 64;
    if(this._version == 2) {
      this._sha = this.buffer.slice(28, 48).toJSON();
      pos += 20;
    }

    var i;
    for(i = 0; i < this._files; ++i) {
      var filename_r = this.buffer.slice(pos, pos+32);
      filename_r = filename_r.toString().trim();
      // var offset = this.buffer.readUInt64BE(pos+32);
      var offset = this.buffer.readUInt32BE(pos+36);
      // var size = this.buffer.readUInt64BE(pos);
      var size = this.buffer.readUInt32BE(pos+44);
      pos+=this._elementsz;

      var data = this.buffer.slice(offset, offset + size);
      var filename = "";
      var j;
      for(j = 0; j < 32; ++j) {
        if(filename_r.charCodeAt(j) == 0) {
          filename = filename_r.substr(0, j);
          delete filename_r;
          break;
        }
      }
      this._filemap[filename] = data;
    }
    this.parse();
  },
  parse: function() {
    var self = this;
    xml2js.parseString(this._filemap["TROP.SFM"], {}, function(e, r) {
      if(e) {
        throw e;
      } else {
        r = r.trophyconf;
        self.npcommid = r.npcommid[0];
        self.title = r["title-name"][0];
        self.detail = r["title-detail"][0];
        self.version = r["trophyset-version"][0];
        r = r.trophy;
        while(r.length) {
          var t = r.shift();
          var a = t["$"];

          var icon = null;
          if(self._filemap["TROP"+a.id+".PNG"] !== undefined) {
            icon = self._filemap["TROP"+a.id+".PNG"].toString("base64");
          }

          self.trophies.push(new TrophyData(a.id, icon, a.hidden, a.ttype, a.pid, t.name[0], t.detail[0]));
        }
        self.done = true;
        self._callback(self);
      }
    })
  },
  dump: function(dest, onlyImages) {
    if(typeof onlyImages != "number") onlyImages = false;
    for(var file in this._filemap) {
      if(onlyImages && this._filemap[file].indexOf(".PNG") == -1) continue;
      fs.writeFileSync(path.join(dest, file), this._filemap[file]);
    }
  }
}

var TrophyData = function(id, icon, hidden, type, pid, name, detail) {
  this.id = id;
  this.icon = icon;
  this.hidden = hidden == "yes";
  this.type = ({"P": "Platinum", "G": "Gold", "S": "Silver", "B": "Bronze"})[type];
  this.pid = pid;
  this.name = name;
  this.description = detail;
}

TrophyData.prototype = {
  toString: function() {
    return "[TrophyData#"+this.id+"]";
  },
  embed: function() {
    return "data:image/png;base64,"+this.icon;
  }
}

exports = module.exports = Trophy;

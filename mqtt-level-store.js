'use strict';

var level = require('level-browserify'),
  sublevel = require('level-sublevel'),
  msgpack = require('msgpack5');

function Store (options) {
  if (!(this instanceof Store)) {
    return new Store(options);
  }

  if (!options.level) {
    throw new Error('missing level');
  }

  this._level = options.level;
  this._levelOpts = {
    valueEncoding: msgpack()
  };
}

Store.prototype.put = function (packet, cb) {
  this._level.put('' + packet.messageId, packet, this._levelOpts, cb);
  return this;
};

Store.prototype.get = function (packet, cb) {
  this._level.get('' + packet.messageId, this._levelOpts, cb);
  return this;
};

Store.prototype.del = function (packet, cb) {
  var key = '' + packet.messageId,
    that = this;
  this._level.get(key, this._levelOpts, function (err, _packet) {
    if (err) {
      return cb(err);
    }

    that._level.del(key, that._levelOpts, function (err2) {
      if (err2) {
        return cb(err2);
      }

      cb(null, _packet);
    });
  });
  return this;
};

Store.prototype.createStream = function () {
  return this._level.createValueStream(this._levelOpts);
};

Store.prototype.close = function (cb) {
  this._level.close(cb);
  return this;
};

function Manager (options) {
  if (!(this instanceof Manager)) {
    return new Manager(options);
  }

  if (options && options.level) {
    this._level = options.level;
  } else {
    this._level = level(options);
  }

  this._sublevel = sublevel(this._level);
  this.incoming = new Store({ level: this._sublevel.sublevel('incoming') });
  this.outgoing = new Store({ level: this._sublevel.sublevel('outgoing') });
}

Manager.single = Store;

Manager.prototype.close = function (done) {
  this.incoming.close();
  this.outgoing.close();
  this._sublevel.close();
  this._level.close(done);
};

module.exports = Manager;

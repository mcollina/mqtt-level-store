'use strict'

var level = require('level-browserify')
var sublevel = require('level-sublevel')
var msgpack = require('msgpack5')
var Readable = require('readable-stream').Readable
var streamsOpts = { objectMode: true }

function Store (options) {
  if (!(this instanceof Store)) {
    return new Store(options)
  }

  if (!options.level) {
    throw new Error('missing level')
  }

  this._level = options.level
  this._levelOpts = {
    valueEncoding: msgpack()
  }
  this._prevDate = null
  this._sameDateCount = 0
}

Store.prototype.put = function (packet, cb) {
  var date = Date.now()
  if (this._prevDate === date) {
    // 1000 packets can be ordered in the same date (milliseconds)
    this._sameDateCount += 0.001
    date += this._sameDateCount
  } else {
    this._sameDateCount = 0
    this._prevDate = date
  }
  this._level.put('' + packet.messageId, [date, packet], this._levelOpts, cb)
  return this
}

Store.prototype.get = function (packet, cb) {
  this._level.get('' + packet.messageId, this._levelOpts, function (err, _timePacket) {
    if (err) {
      return cb(err)
    }
    cb(null, _timePacket[1])
  })
  return this
}

Store.prototype.del = function (packet, cb) {
  var key = '' + packet.messageId
  var that = this

  this._level.get(key, this._levelOpts, function (err, _timePacket) {
    if (err) {
      return cb(err)
    }

    that._level.del(key, that._levelOpts, function (err2) {
      if (err2) {
        return cb(err2)
      }

      cb(null, _timePacket[1])
    })
  })
  return this
}

Store.prototype.createStream = function () {
  var stream = new Readable(streamsOpts)
  var destroyed = false
  var timePackets = []
  var i = 0

  var levelStream = this._level.createValueStream(this._levelOpts)
    .on('data', function (data) {
      timePackets.push(data)
    })
    .on('end', function () {
      timePackets.sort(function (lhs, rhs) {
        return lhs[0] - rhs[0]
      })
      stream.resume()
    })

  stream._read = function () {
    if (!destroyed && i < timePackets.length) {
      this.push(timePackets[i++][1])
    } else {
      this.push(null)
    }
  }

  stream.destroy = function () {
    if (destroyed) {
      return
    }

    levelStream.destroy()
    var self = this

    destroyed = true
    process.nextTick(function () {
      self.emit('close')
    })
  }

  stream.pause()
  return stream
}

Store.prototype.close = function (cb) {
  this._level.close(cb)
  return this
}

function Manager (path, options) {
  if (!(this instanceof Manager)) {
    return new Manager(path, options)
  }

  if (typeof path === 'object') {
    options = path
    path = null
  }

  if (options && options.level) {
    this._level = options.level
  } else {
    this._level = level(path, options)
  }

  this._sublevel = sublevel(this._level)
  this.incoming = new Store({ level: this._sublevel.sublevel('incoming') })
  this.outgoing = new Store({ level: this._sublevel.sublevel('outgoing') })
}

Manager.single = Store

Manager.prototype.close = function (done) {
  this.incoming.close()
  this.outgoing.close()
  this._sublevel.close()
  this._level.close(done)
}

module.exports = Manager

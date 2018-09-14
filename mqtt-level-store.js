'use strict'

var level = require('level-browserify')
var sublevel = require('level-sublevel')
var msgpack = require('msgpack5')

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
  this._sameDateCount = 0
  this._prevDate = null
}

const zeroPadding = (function () {
  // width and padding calculates only once
  const width = parseInt(Number.MAX_SAFE_INTEGER).toString(10).length
  const padding = new Array(width + 1).join('0')
  return function (num) {
    return (padding + num).slice(-width)
  }
})()

Store.prototype.put = function (packet, cb) {
  var date = new Date().toISOString()
  if (this._prevDate === date) {
    ++this._sameDateCount
  } else {
    this._sameDateCount = 0
    this._prevDate = date
  }
  date += zeroPadding(this._sameDateCount)

  var that = this
  this._level.get(
    'packets~' + packet.messageId,
    this._levelOpts,
    function (err, _date) {
      if (err) {
        if (!err.notFound) return cb(err)
        var cmd = [
          {type: 'put', key: 'packets~' + packet.messageId, value: date},
          {type: 'put', key: 'packet-by-date~' + date + '~' + packet.messageId, value: packet}
        ]
        that._level.batch(cmd, that._levelOpts, cb)
      } else {
        that._level.get(
          'packet-by-date~' + _date + '~' + packet.messageId,
          that._levelOpts,
          function (err, _packet) {
            if (err) return cb(err)
            if (packet.cmd === _packet.cmd) return cb()
            that._level.put('packet-by-date~' + _date + '~' + packet.messageId, packet, that._levelOpts, cb)
          })
      }
    })
  return this
}

Store.prototype.get = function (packet, cb) {
  var that = this
  this._level.get(
    'packets~' + packet.messageId,
    this._levelOpts,
    function (err, date) {
      if (err) return cb(err)
      that._level.get(
        'packet-by-date~' + date + '~' + packet.messageId,
        that._levelOpts,
        cb)
    })
  return this
}

Store.prototype.del = function (packet, cb) {
  var that = this
  this._level.get(
    'packets~' + packet.messageId,
    this._levelOpts,
    function (err, date) {
      if (err) return cb(err)
      that._level.get(
        'packet-by-date~' + date + '~' + packet.messageId,
        that._levelOpts,
        function (err, _packet) {
          if (err) return cb(err)
          var cmd = [
            {type: 'del', key: 'packets~' + packet.messageId},
            {type: 'del', key: 'packet-by-date~' + date + '~' + packet.messageId}
          ]
          that._level.batch(
            cmd,
            that._levelOpts,
            function (err) {
              if (err) return cb(err)
              cb(null, _packet)
            })
        })
    })
  return this
}

Store.prototype.createStream = function () {
  var opts = this._levelOpts
  opts.keys = false
  opts.lt = 'packet-by-date~\xff'
  opts.gt = 'packet-by-date~'
  return this._level.createReadStream(opts)
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
  var incomingCloseCalled = false
  var outgoingCloseCalled = false
  var subLevelCloseCalled = false
  var levelCloseCalled = false
  var errors = {}

  function tryAllClosed () {
    if (incomingCloseCalled && outgoingCloseCalled && subLevelCloseCalled && levelCloseCalled) {
      if (Object.keys(errors).length > 0) {
        done(new Error(JSON.stringify(errors)))
      } else {
        done()
      }
    }
  }

  this.incoming.close(function (err) {
    incomingCloseCalled = true
    if (err) errors['incoming'] = err.message
    tryAllClosed()
  })
  this.outgoing.close(function (err) {
    outgoingCloseCalled = true
    if (err) errors['outgoing'] = err.message
    tryAllClosed()
  })
  this._sublevel.close(function (err) {
    subLevelCloseCalled = true
    if (err) errors['sublevel'] = err.message
    tryAllClosed()
  })
  this._level.close(function (err) {
    levelCloseCalled = true
    if (err) errors['level'] = err.message
    tryAllClosed()
  })
}

module.exports = Manager

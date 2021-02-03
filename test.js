'use strict'

/* eslint-env mocha */

var abstractTest = require('mqtt/test/abstract_store')
var level = require('level-test')()
var mqttLevelStore = require('./')
var mqtt = require('mqtt')
var Connection = require('mqtt-connection')
var concat = require('concat-stream')
var net = require('net')
var should = require('should')

describe('mqtt level store', function () {
  abstractTest(function (done) {
    done(null, mqttLevelStore.single({ level: level() }))
  })
})

describe('mqtt level store manager', function () {
  var manager

  beforeEach(function () {
    manager = mqttLevelStore({ level: level() })
  })

  afterEach(function (done) {
    manager.close(done)
  })

  describe('incoming', function () {
    abstractTest(function (done) {
      done(null, manager.incoming)
    })
  })

  describe('outgoing', function () {
    abstractTest(function (done) {
      done(null, manager.outgoing)
    })
  })
})

describe('mqtt level store manager close', function () {
  it('should finish successfully.', function (done) {
    var manager = mqttLevelStore({ level: level() })
    manager.close(done)
  })

  it('should return errors when failed to close.', function (done) {
    var errorManager = mqttLevelStore({ level: level() })

    var incomingCloseSaved = errorManager.incoming.close
    var outgoingCloseSaved = errorManager.outgoing.close
    var subLevelCloseSaved = errorManager._sublevel.close
    var levelCloseSaved = errorManager._level.close

    errorManager.incoming.close = function (cb) { cb(new Error('error_i')) }
    errorManager.outgoing.close = function (cb) { cb(new Error('error_o')) }
    errorManager._sublevel.close = function (cb) { cb(new Error('error_s')) }
    errorManager._level.close = function (cb) { cb(new Error('error_l')) }

    var expected = { 'incoming': 'error_i', 'outgoing': 'error_o', 'sublevel': 'error_s', 'level': 'error_l' }
    errorManager.close(function (err) {
      should.deepEqual(JSON.parse(err.message), expected)
      errorManager.incoming.close = incomingCloseSaved
      errorManager.outgoing.close = outgoingCloseSaved
      errorManager._sublevel.close = subLevelCloseSaved
      errorManager._level.close = levelCloseSaved
      errorManager.close(function (err) {
        should.not.exist(err)
        done()
      })
    })
  })
})

describe('mqtt.connect flow', function () {
  var server
  var manager

  beforeEach(function (done) {
    server = new net.Server()
    server.listen(8883, done)

    server.on('connection', function (stream) {
      var client = Connection(stream)

      client.on('connect', function () {
        client.connack({ returnCode: 0 })
      })

      server.emit('client', client)
    })

    manager = mqttLevelStore({ level: level() })
  })

  afterEach(function (done) {
    server.close(done)
  })

  it('should resend messages by published order', function (done) {
    var serverCount = 0
    var client = mqtt.connect({
      port: 8883,
      incomingStore: manager.incoming,
      outgoingStore: manager.outgoing
    })

    client.nextId = 65535
    client.publish('topic', 'payload1', { qos: 1 })
    client.publish('topic', 'payload2', { qos: 1 })
    client.publish('topic', 'payload3', { qos: 1 })
    server.once('client', function (serverClient) {
      serverClient.once('publish', function () {
        serverClient.stream.destroy()

        manager.outgoing.createStream().pipe(concat(function (list) {
          list.length.should.equal(3)
        }))
      })

      server.once('client', function (serverClient2) {
        serverClient2.on('publish', function (packet) {
          serverClient2.puback(packet)
          switch (serverCount++) {
            case 0:
              packet.payload.toString().should.equal('payload1')
              break
            case 1:
              packet.payload.toString().should.equal('payload2')
              break
            case 2:
              packet.payload.toString().should.equal('payload3')
              setTimeout(function () {
                // make sure additional publish shouldn't be received
                serverCount.should.equal(3)
                client.end()
                done()
              }, 200)
              break
            default:
              break
          }
        })
      })
    })
  })
})

// Topic Alias extract scenario
// Topic Alias mapping
// 'topic1' : 123
// Topic Aliased packet is TopicName: '', Property TopicAlias: 123
// Overwrite
// TopicName: '' to 'topic1', remove Property TopicAlias
describe('overwrite', function () {
  var manager

  beforeEach(function () {
    manager = mqttLevelStore({ level: level() })
  })

  afterEach(function (done) {
    manager.close(done)
  })

  function testOverwrite (store, done) {
    var packet = {
      cmd: 'publish',
      topic: '',
      payload: 'msg',
      qos: 1,
      retain: false,
      messageId: 1,
      dup: false,
      properties: { topicAlias: 123 }
    }

    store.put(packet, function (err) {
      if (!err) {
        store.get(packet, function (err, packet2) {
          if (!err) {
            packet2.should.have.property('topic', '')
            packet2.should.have.property('properties')
            packet2.properties.should.have.property('topicAlias', 123)

            packet2.topic = 'topic1'
            packet2.properties = {}
            store.put(packet2, function (err) {
              if (!err) {
                store.get(packet2, function (err, packet3) {
                  if (!err) {
                    packet3.should.have.property('topic', 'topic1')
                    packet3.should.have.property('properties')
                    packet2.properties.should.not.have.property('topicAlias')
                    done()
                  }
                })
              }
            })
          }
        })
      }
    })
  }

  it('should be able to overwrite incoming', function (done) {
    testOverwrite(manager.incoming, done)
  })

  it('should be able to overwrite outgoing', function (done) {
    testOverwrite(manager.outgoing, done)
  })
})

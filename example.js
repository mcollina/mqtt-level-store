'use strict'

var mqtt = require('mqtt')
var levelStore = require('./')
var manager = levelStore('db')
var client

client = mqtt.connect({
  port: 1883,
  incomingStore: manager.incoming,
  outgoingStore: manager.outgoing
})

client.on('connect', function () {
  console.log('connected')
  client.publish('hello', 'world', { qos: 1 }, function () {
    console.log('published')
    client.end()
  })
})

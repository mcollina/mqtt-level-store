'use strict'

const mqtt = require('mqtt')
const levelStore = require('./')
const manager = levelStore('db')
const client = mqtt.connect({
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

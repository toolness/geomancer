var assert = require('assert');
var sys = require("sys");
var geo = require('./geomancer');

assert.deepEqual(geo.parsePath('/foo'), null);

assert.deepEqual(geo.parsePath('/foo/'), {
  channel: 'foo',
  command: null
});

assert.deepEqual(geo.parsePath('/foo/bar'), {
  channel: 'foo',
  command: 'bar'
});

var infos = [];
var channel = new geo.Channel(function now() {
  return new Date(1995,11,17);
});
channel.on('update', function(info) {
  infos.push(info);
});
assert.equal(channel.revision, 0);
assert.deepEqual(infos, []);
channel.update('foo', {
  a: 1,
  b: "hi"
});
assert.deepEqual(infos[0], {
  revision: 1,
  name: "foo",
  status: {
    data: {
      a: 1,
      b: "hi",
    },
    timestamp: "1995-12-17T08:00:00Z"
  }
});
assert.deepEqual(channel.statuses.foo.data, {
  a: 1,
  b: "hi"
});
channel.update('foo', {
  a: 2,
  b: "bye"
});
assert.deepEqual(channel.statuses.foo.data, {
  a: 2,
  b: "bye"
});



sys.puts("Tests successful.");

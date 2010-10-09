var assert = require('assert');
var sys = require("sys");
var geo = require('./geomancer');

assert.deepEqual(geo.parsePath('/foo'), {
  channel: 'foo'
});

var infos = [];
var channel = new geo.Channel();
channel.on('update', function(info) {
  infos.push(info);
});
assert.equal(channel.revision, 0);
assert.deepEqual(infos, []);
channel.update('foo', {
  a: 1,
  b: "hi"
});
assert.deepEqual(infos[0].status.data, {
  a: 1,
  b: "hi"
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

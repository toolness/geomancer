var assert = require('assert');
var sys = require("sys");
var geo = require('./geomancer');
var geoServer = require('./server');

function whenDone() {
  sys.puts("Tests successful.");
}

function TimeMachine(now) {
  this.now = function() {
    return new Date(now);
  };

  this.travel = function(ms) {
    now += ms;
  };
}

(function parsePathTests() {
  assert.deepEqual(geo.parsePath('/foo'), null);

  assert.deepEqual(geo.parsePath('/foo/'), {
    channel: 'foo',
    command: null
  });

  assert.deepEqual(geo.parsePath('/foo/bar'), {
    channel: 'foo',
    command: 'bar'
  });
})();

(function channelTests() {
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
})();

(function expiringChannelMapTests() {
  var timeMachine = new TimeMachine(0);

  var map = new geo.ExpiringChannelMap({
    lifetime: 1000,
    now: timeMachine.now
  });

  assert.equal(map.get('foo').revision, 0);
  map.get('foo').update('bar', 'hello');
  assert.equal(map.get('foo').revision, 1);
  timeMachine.travel(1000);
  assert.equal(map.get('foo').revision, 0);
})();

(function serverTests(onDone) {
  // TODO: Add tests for
  // curl http://localhost:8342/foome": "bob", "status": "hello"}'
  // curl http://localhost:8342/foo/statuses\?r=3

  const PORT = 9999;

  var http = require('http');
  var timeMachine = new TimeMachine(0);
  var channels = new geo.ExpiringChannelMap({
    lifetime: 1000,
    now: timeMachine.now
  });
  var onRequest = geoServer.create({
    channels: channels
  });

  var server = http.createServer(onRequest);
  server.listen(PORT, function() {
    var client = http.createClient(PORT, 'localhost');
    
    var asyncTests = {
      basic404: function(onDone) {
        var request = client.request('GET', '/');
        request.end();
        request.on('response', function(response) {
          assert.equal(response.statusCode, 404);
          response.on('end', function() {
            server.close();
            onDone();
          });
        });
      }
    };

    var asyncTestArray = [];
    for (name in asyncTests)
      asyncTestArray.push(name);

    var currTestIndex = 0;

    function runNextTest() {
      if (asyncTestArray.length == currTestIndex)
        onDone();
      else {
        var name = asyncTestArray[currTestIndex++];
        asyncTests[name](runNextTest);
      }
    }

    runNextTest();
  });
})(whenDone);

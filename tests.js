var assert = require('assert');
var sys = require("sys");
var geo = require('./geomancer');
var geoServer = require('./server');

function TimeMachine(now) {
  this.now = function() {
    return new Date(now);
  };

  this.travel = function(ms) {
    now += ms;
  };
}

function runAsyncTests(tests, onDone) {
  var testArray = [];
  for (name in tests)
    testArray.push(name);

  var currTestIndex = 0;

  function runNextTest() {
    if (testArray.length == currTestIndex)
      onDone();
    else {
      var name = testArray[currTestIndex++];
      sys.puts('test ' + name);
      tests[name](runNextTest);
    }
  }

  runNextTest();
}

runAsyncTests({
  parsePathTests: function(onDone) {
    assert.deepEqual(geo.parsePath('/foo'), null);

    assert.deepEqual(geo.parsePath('/foo/'), {
      channel: 'foo',
      command: null
    });

    assert.deepEqual(geo.parsePath('/foo/bar'), {
      channel: 'foo',
      command: 'bar'
    });
    
    onDone();
  },

  channelTests: function(onDone) {
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
    
    onDone();
  },

  expiringChannelMapTests: function(onDone) {
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
    
    onDone();
  },

  serverTests: function(onDone) {
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
      function client() {
        return http.createClient(PORT, 'localhost');
      }

      runAsyncTests({
        longPollAndUpdate: function(onDone) {
          var longPollReq = client().request('GET', '/foo/statuses?r=1');
          longPollReq.end();
          longPollReq.on('response', function(response) {
            assert.equal(response.statusCode, 200);
            assert.equal(response.headers['content-type'],
                         'application/json');
            var chunks = [];
            response.on('data', function(chunk) {
              chunks.push(chunk);
            });
            response.on('end', function() {
              assert.deepEqual(JSON.parse(chunks.join('')), {
                revision: 1,
                statuses: {
                  bob: {
                    data: "hello",
                    timestamp: "1970-01-01T00:00:00Z"
                  }
                }
              });
              onDone();
            });
          });

          var updateReq = client().request('POST', '/foo/update');
          updateReq.end(JSON.stringify({
            name: 'bob',
            status: 'hello'
          }));
          updateReq.on('response', function(response) {
            assert.equal(response.statusCode, 200);
          });
        },
        channelIndexHTML: function(onDone) {
          var request = client().request('GET', '/foo/');
          request.end();
          request.on('response', function(response) {
            assert.equal(response.statusCode, 200);
            assert.equal(response.headers['content-type'],
                         'text/html; charset=utf-8');
            response.on('end', onDone);
          });
        },
        basic404: function(onDone) {
          var request = client().request('GET', '/');
          request.end();
          request.on('response', function(response) {
            assert.equal(response.statusCode, 404);
            response.on('end', onDone);
          });
        }
      }, function whenServerTestsAreDone() {
        server.close();
        onDone();
      });
    });
  }
}, function whenAllTestsAreDone() {
  sys.puts('All tests successful.');
});

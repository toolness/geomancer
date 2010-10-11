var http = require('http');
var url = require('url');
var fs = require('fs');
var sys = require('sys');

var geo = require('./geomancer');

const DEFAULT_PORT = 8342;
const DEFAULT_LONG_POLL_TIMEOUT = 60000;

function return404(response) {
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.end('Not Found\n');
}

function returnBadRequest(response) {
  response.writeHead(400, {'Content-Type': 'text/plain'});
  response.end('Bad Request\n');
}

function returnJSON(response, obj) {
  response.writeHead(200, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(obj));
}

function receiveUpdate(request, response, channel) {
  var chunks = [];
  request.setEncoding('utf8');
  request.on('data', function(chunk) {
    chunks.push(chunk);
  });
  request.on('end', function() {
    try {
      var update = JSON.parse(chunks.join(''));
    } catch (e) {
      returnBadRequest(response);
      return;
    }
    if ('name' in update &&
        typeof(update.name) == "string" &&
        update.name.length > 0 &&
        'status' in update) {
      channel.update(update.name, update.status);
      returnJSON(response, {success: true});
    } else
      returnBadRequest(response);
  });
}

function returnStatuses(response, channel, revision, longPollTimeout) {
  var timeout = null;
  
  function onUpdate() {
    if (timeout !== null)
      clearTimeout(timeout);
    channel.removeListener('update', onUpdate);
    returnJSON(response, {
      revision: channel.revision,
      statuses: channel.statuses
    });
  }

  function onTimeout() {
    channel.removeListener('update', onUpdate);
    response.writeHead(304, 'Not Modified', {'Content-Type': 'text/plain'});
    response.end();
  }

  if (revision > channel.revision) {
    timeout = setTimeout(onTimeout, longPollTimeout);
    channel.on('update', onUpdate);
  } else
    onUpdate();
}

function create(options) {
  if (!options.channels)
    throw new Error("options.channels must be present");

  var channels = options.channels;
  var longPollTimeout = options.longPollTimeout || DEFAULT_LONG_POLL_TIMEOUT;

  return function(request, response) {
    var info = url.parse(request.url, true);
    var pathInfo = geo.parsePath(info.pathname);
    if (pathInfo) {
      if (pathInfo.command == null) {
        var file = fs.createReadStream('index.html');
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8'
        });
        sys.pump(file, response);
        return;
      } else {
        var channel = channels.get(pathInfo.channel);

        switch (pathInfo.command) {
          case 'statuses':
            var revision = -1;
            if (info.query &&
                'r' in info.query &&
                info.query.r.match(/[1-9][0-9]*/))
              revision = parseInt(info.query.r);

            returnStatuses(response, channel, revision, longPollTimeout);
            return;
          case 'update':
            receiveUpdate(request, response, channel);
            return;
        }
      }
    }
    return404(response);
  };
}

exports.create = create;

if (require.main == module) {
  http.createServer(create({
    channels: new geo.ExpiringChannelMap({
      lifetime: 1000 * 60 * 60
    })
  })).listen(DEFAULT_PORT);
  sys.puts('Serving on port ' + DEFAULT_PORT);
}

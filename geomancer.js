var events = require('events');
var sys = require('sys');

function Channel() {
  var self = this;
  var rev = 0;
  var statuses = {};

  events.EventEmitter.call(self);

  Object.defineProperty(self, 'revision', {
    get: function() {
      return rev;
    },
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(self, 'statuses', {
    get: function() {
      // TODO: Return a read-only copy.
      return statuses;
    },
    enumerable: true,
    configurable: false
  });

  self.update = function(name, status) {
    statuses[name] = {
      data: status,
      timestamp: new Date().toString()
    };
    rev++;
    self.emit('update', {
      revision: rev,
      name: name,
      status: statuses[name]
    });
  };
}

sys.inherits(Channel, events.EventEmitter);

exports.Channel = Channel;

exports.parsePath = function parsePath(path) {
  var re = /\/([A-Za-z0-9]+)\/([A-Za-z]*)/;
  var match = path.match(re);
  if (match) {
    return {
      channel: match[1],
      command: match[2] || null
    };
  } else
    return null;
};

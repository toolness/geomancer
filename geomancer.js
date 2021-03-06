var events = require('events');
var sys = require('sys');

function pad(n) {
  return n<10 ? '0'+n : n;
}

// Taken from:
// https://developer.mozilla.org/en/JavaScript/Reference/global_objects/date
function ISODateString(d) {
  return d.getUTCFullYear()+'-'
         + pad(d.getUTCMonth()+1)+'-'
         + pad(d.getUTCDate())+'T'
         + pad(d.getUTCHours())+':'
         + pad(d.getUTCMinutes())+':'
         + pad(d.getUTCSeconds())+'Z';
}

function defaultNow() {
  return new Date();
}

function ExpiringChannelMap(options) {
  if (typeof(options.lifetime) != "number")
    throw new Error("options.lifetime must be a number");

  var self = this;
  var now = options.now || defaultNow;
  var lifetime = options.lifetime;
  var lastCheck = now();
  var intervalMS = options.intervalMS || (options.lifetime / 5);
  var map = {};

  function maybeExpireChannels(rightNow) {
    if (rightNow - lastCheck >= intervalMS) {
      lastCheck = rightNow;
      for (name in map)
        if (map[name].expiry <= rightNow)
          delete map[name];
    }
  }

  self.get = function get(name) {
    var rightNow = now();

    maybeExpireChannels(rightNow);

    if (!(name in map))
      map[name] = {channel: new Channel(now)};

    map[name].expiry = new Date(rightNow.getTime() + lifetime);
    return map[name].channel;
  };
}

function Channel(now) {
  var self = this;
  var rev = 0;
  var statuses = {};

  if (!now)
    now = defaultNow;

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
      timestamp: ISODateString(now())
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
exports.ExpiringChannelMap = ExpiringChannelMap;

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

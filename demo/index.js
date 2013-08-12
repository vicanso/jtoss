(function() {
  var Client, client, _;

  _ = require('underscore');

  Client = require('../lib/client');

  client = new Client('akuluq6no78cynryy8nfbl23', 'k6k0jKekWlZn0ciqKLZr+mwrozo=');

  client.watch('jenny', 'a', '/Users/Tree/tmp', function() {
    return console.dir(arguments);
  });

}).call(this);

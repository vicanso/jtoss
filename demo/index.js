(function() {
  var Client, app, client, files, progress, _;

  _ = require('underscore');

  Client = require('../lib/client');

  client = new Client('akuluq6no78cynryy8nfbl23', 'k6k0jKekWlZn0ciqKLZr+mwrozo=');

  progress = function() {
    return console.dir(arguments);
  };

  files = ['/Users/tree/Downloads/办业务_报价回购权限设置_关闭权限.psd', '/Users/tree/Downloads/办业务_报价回购权限设置_开通权限01.psd', '/Users/tree/Downloads/办业务_退市股票权限设置_开通权限02.psd'];

  client.putObjectFromFileList('jenny', files, {
    progress: progress
  }, function(err, data) {
    console.dir('complete');
    console.dir(err);
    return console.dir(data);
  });

  app = require('express')();

  app.listen(10000);

}).call(this);

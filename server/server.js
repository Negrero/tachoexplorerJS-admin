var loopback = require('loopback');
var boot = require('loopback-boot');
var tty=require('tty.js');
var http = require('http');
var https = require('https');
var path = require('path');
var server = require('socket.io');
var pty = require('pty.js');
var fs = require('fs');

var app = module.exports = loopback();

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};


// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {

  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) {
    //app.start();

    // inject socket.io server inside app
    app.io = require('socket.io')(app.start(),{path: '/wetty/socket.io'});

    /*
    // configure the socket.io adapter using redis like pubsub messages manager
    // to replicate the events and handshake between all cluster worker process
    var redis = require('socket.io-redis');
    try {
      app.io.adapter(redis({host: 'localhost', port: 6379}));
    }
    catch(err) {
      logger.error('Error connecting to redis' , {fileName: 'server.js', method: 'boot', stack: err.stack});
    }
*/
    app.io.on('connection', function(socket) {
      console.log('a user connected');

      var sshuser = 'ubuntu';
      var request = socket.request;
      console.log((new Date()) + ' Connection accepted.');
      if (match = request.headers.referer.match('/wetty/ssh/.+$')) {
        sshuser = match[0].replace('/wetty/ssh/', '') + '@';
      } else if ("ubuntu") {
        sshuser = "ubuntu" + '@';
      }

      var term;
      if (process.getuid() == 0) {
        term = pty.spawn('/bin/login', [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 30
        });
      } else {
	// host ---->
        term = pty.spawn('ssh', [sshuser+"", '-p', 22, '-o', 'PreferredAuthentications=' + 'password'], {
          name: 'xterm-256color',
          cols: 80,
          rows: 30
        });
      }
      console.log((new Date()) + " PID=" + term.pid + " STARTED on behalf of user=" + sshuser)
      term.on('data', function(data) {
        socket.emit('output', data);
      });
      term.on('exit', function(code) {
        console.log((new Date()) + " PID=" + term.pid + " ENDED")
      });
      socket.on('resize', function(data) {
        term.resize(data.col, data.row);
      });
      socket.on('input', function(data) {
        term.write(data);
      });
      socket.on('disconnect', function() {
        term.end();
      });
    });
  }
});

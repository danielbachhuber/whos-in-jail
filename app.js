
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , spawn = require('child_process').spawn
  , ejs = require('ejs')
  , inmates = require('./inmates.js')
  , path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

app.get('/inmates.json', function(req, res) {
  res.jsonp( inmates.readAsJson() );
});

app.get('/update', function(req,res) {
  res.send('starting a scrape'); //TODO: would be better to wait until the scraper is done so we don't have to guess when we can call /inmates.json
	inmates.refreshSrc();
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

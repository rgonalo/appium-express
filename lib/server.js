import path from 'path';
import express from 'express';
import http from 'http';
import favicon from 'serve-favicon';
import bodyParser from 'body-parser';
import methodOverride from 'method-override';
import log from './logger';
import { startLogFormatter, endLogFormatter } from './express-logging';
import { allowCrossDomain, fixPythonContentType, catchAllHandler,
         catch404Handler, catch4XXHandler } from './middleware';
import { guineaPig, welcome, STATIC_DIR } from './static';
import { produceError, produceCrash } from './crash';


async function server (configureRoutes, port, hostname = 'localhost') {
  // create the actual http server
  let app = express();
  let httpServer = http.createServer(app);

  return await new Promise((resolve, reject) => {
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRNOTAVAIL') {
        log.error('Could not start REST http interface listener. ' +
                  'Requested address is not available.');
      } else {
        log.error('Could not start REST http interface listener. The requested ' +
                  'port may already be in use. Please make sure there is no ' +
                  'other instance of this server running already.');
      }
      reject(err);
    });
    httpServer.on('connection', (socket) => {
      socket.setTimeout(600 * 1000); // 10 minute timeout
    });
    configureServer(app, configureRoutes);
    httpServer.listen(port, hostname, (err) => {
      if (err) {
        reject(err);
      }
      resolve(httpServer);
    });
  });
}

function configureServer (app, configureRoutes) {
  // set up logging
  app.use(endLogFormatter);
  app.use(startLogFormatter);

  // set up static assets
  app.use(favicon(path.resolve(STATIC_DIR, 'favicon.ico')));
  app.use(express.static(STATIC_DIR));

  // crash routes, for testing
  app.use('/wd/hub/produce_error', produceError);
  app.use('/wd/hub/crash', produceCrash);

  // add middlewares
  app.use(allowCrossDomain);
  app.use(fixPythonContentType);
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(methodOverride());
  app.use(catch4XXHandler);
  app.use(catchAllHandler);

  // make sure appium never fails because of a file size upload limit
  app.use(bodyParser.json({limit: '1gb'}));

  configureRoutes(app);

  // dynamic routes for testing, etc.
  app.all('/welcome', welcome);
  app.all('/test/guinea-pig', guineaPig);

  // catch this last, so anything that falls through is 404ed
  app.use(catch404Handler);
}

export { server, configureServer };

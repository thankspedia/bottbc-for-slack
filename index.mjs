
import fs         from 'fs';
import path       from 'path';
import process    from 'process';
import express    from 'express';
import bodyParser from 'body-parser';
import cors       from 'cors';

// Load the main module of the backend of tBC Application System.
import { load_context_factory } from "./context.mjs";

// Load the API module for Slack
import { WebClient as SlackWebClient } from '@slack/web-api';

// Load "dotenv" like environment variable manager of the module `Asynchronous-Context`
import { dotenvFromSettings } from "asynchronous-context/env" ;

// Load Environment Variables from `.settings` file.
dotenvFromSettings();

// Create an initialize an instance of Slack client
console.log( 'SLACK_TOKEN', process.env.SLACK_TOKEN );
const web = new SlackWebClient( process.env.SLACK_TOKEN );

// Instanciate a factory of API context object for tBC Application System.
const context_factory = load_context_factory();


// Define the main procedure.
async function procedure(nargs) {

  // Connect to our postgresql database instance.
  await this.connect_database();

  // Begin a database transaction.
  await this.begin_transaction();

  // If a default parent is specified as a username, convert it to a `user_id`.
  if ( nargs.default_parent_username ) {
    const { user_id } = (await this.username2user_id({ username : nargs.default_parent_username }));
    nargs.default_parent_user_id = user_id;
  }

  // If a member user is specified as a username, convert it to a `user_id`.
  if ( nargs.member_username != null ) {
    const { user_id } = (await this.username2user_id({ username : nargs.member_username }));
    nargs.member_user_id = user_id;
  } else {
    nargs.member_user_id = null;
  }

  // If a user is specified as a username, convert it to a `user_id`.
  if ( nargs.username != null ) {
    const { user_id } = (await this.username2user_id({ username : nargs.username }));
    nargs.user_id = user_id;
  } else {
    nargs.user_id = null;
  }

  // Decide which timeline is to be sent owr messages as timeline name. See tBC glossary.
  const timelinename = 'local_public_output_timeline';

  let timeline = null;

  // Branch dependiing on a member user is specified or not.
  if ( ( nargs.member_user_id ?? false ) && ( nargs.member_user_id !== nargs.user_id ) ) {
    // Retrieve the timeline id of our target timeline.
    timeline = (await this.read_user_member_timeline({
      user_id        : nargs.user_id,
      member_user_id : nargs.member_user_id,
      timelinename   : timelinename,
    }));
  } else {

    // Retrieve the timeline id of our target timeline.
    timeline = (await this.read_user_timeline({
      user_id      : nargs.user_id,
      timelinename : timelinename,
    })).singleRow;

  }

  // Send the specified message to the timeline we retrieved in the previous line.
  const tweet = await this.send_tweet({
    scope_id               : nargs.scope_id,
    default_parent_user_id : nargs.default_parent_user_id,
    user_id                : nargs.user_id,
    member_user_id         : nargs.member_user_id,
    timeline_id            : timeline.timeline_id,
    message_text           : nargs.message_text,
    message_content_type   : nargs.message_content_type,
    parent_message_id      : null,
  });

  // Commit the current transaction.
  await this.commit_transaction();

  // Disconnect from the database.
  await this.disconnect_database();
}


// Define a utility to parse a specified request body.
function parse_request_body( text_request_body ) {
  try {
    return JSON.parse( text_request_body );
  } catch ( e ) {
    console.error( 'parse_request_body : *** ERROR ***',  e, text_request_body );
    throw new Error( 'JSON error',  { cause : e } );
  }
}

// Create a middleware for Express 4
function __create_middleware() {
  return (
    async function (req, res, next) {
      // We process a sent request only when it is a post request.
      if ( req.method === 'POST' ) {
        // Parse the request body.
        const json = parse_request_body( req.body );

        console.log( 'json from slack:', json );

        // See the command type. See Slack API documentation.

        // Respond to a URL verification challenge from Slack server
        if ( json.type  === 'url_verification' ) {
          // Respond to the challenge.
          res.status(200).send( json.challenge ).end();


        } else if ( json.type === 'event_callback' ) {

          // Respond to a URL verification challenge from Slack server
          if ( typeof json.event.bot_id === 'string' ) {
            // ignore
            res.status(200).json({status:'succeeded', reason : 'ignored'     }).end();
          } else {
            try {
              // Get the message text from Slack server.
              const receivedText = json.event.text.replace( /<@[a-zA-Z0-9]+>/g,'' );

              // Ask the Slack server to send a message. Recite it to the user on the Slack.
              await web.chat.postMessage({
                // channel: '#general',
                channel: json.event.channel,
                text: receivedText ,
                // text: `The current time is ${(new Date()).toString() }`,
                // text: `山川さん、ボットからの書き込みに成功致しました！`,
                // text : message,
              });

              // Create a tBC API context object.
              const context = (await context_factory()).setOptions({ suppressSuccessfulReport:false, autoCommit:true, showReport:true, coloredReport:true, reportMethod:'stderr' });

              // Initialize name arguments.
              const nargs={
                scope_id                : 'local',
                default_parent_user_id  : null,
                default_parent_username : 'ttc',
                username                : 'ttc',
                member_username         : 'matsushima',
                message_text            : receivedText,
                message_content_type    : 'content_text',
              };

              // Execute our defined procedure in the created context.
              context.executeTransaction( procedure, nargs );

              // Respond to the request.
              res.status(200).json({status:'succeeded', reason : 'sent'     }).end();

              // Succeeded.
              console.log( "successfully sent");
            } catch (e) {
              console.log( "failed", e );
              // Respond that the request was unsuccessful.
              res.status(500).json({status:'failed',    reason : 'not sent' }).end();
            }
          }
        } else {
          // Throw an error to other requests.
          res.status(404).json({status:'error', reason : 'not found' }).end();
        }

      } else {
        // Error if the request is not a post request.
        res.status(404).json({status:'error', reason : 'not found' } ).end();
      }
    }
  );
}

// Create a route object as a middleware server.
export function create_middleware() {
  const router = express.Router();
  router.use((req,res,next)=>{
    console.log( "middleware:", req.url );
    next();
  });

  // router.use(express.json());
  router.use(bodyParser.urlencoded({ extended: true }));
  router.use(bodyParser.text({type:"*/*"}));
  router.all( '/api', __create_middleware() );
  router.all( '(.*)', function ( req, res, next ) {
    res.status(404).json({status:'error', reason : 'not found' } ).end();
  });
  return router;
}


// Define a service for our middleware.
function createService() {
  // Initializing the app.
  const app = express();
  // const cors_origins = [
  //   "http://localhost:3000",
  //   "http://localhost:3001",
  //   "http://172.16.41.41:3000"
  // ];
  const cors_origins = function( origin, callback ) {
    callback( null, /.*/ );
  };

  // app.use(require('morgan')('dev'));
  app.use( (req,res,next)=>{
    console.log( 'req.path', req.method, req.path );
    next();
  });

  app.use( cors( { origin : cors_origins } ) );

  app.use( '/' , create_middleware() );

  return app;
}


// Start the service.
createService().listen( 3002, ()=>{
  console.log( 'started port:3002' );
});


// That's all. Thank you very much!




//  const context = await context_factory();
//
//  const nargs={
//    scope_id : 'local',
//    default_parent_user_id : null,
//    default_parent_username : 'ttc',
//    username : 'ttc',
//    member_username : 'a-oka-z',
//    message_text : 'hello',
//    message_content_type : 'content_text',
//  };
//  context.executeTransaction( procedure, nargs );


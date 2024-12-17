
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

import { encrypt_password } from "coretbc/password_cipher.mjs";

// Load Environment Variables from `.settings` file.
dotenvFromSettings();

// Create an initialize an instance of Slack client
console.log( 'SLACK_TOKEN', process.env.SLACK_TOKEN );
const web = new SlackWebClient( process.env.SLACK_TOKEN );

// Instanciate a factory of API context object for tBC Application System.
const create_context = load_context_factory();

/*
 * Parse a string like `xxxx@xxxx` and get username and member_username from it.
 */
const process_parsed_text = (parsed_text)=>{
  const [
    matched_text,
    login_command ,
    login_multiverse_username,
    login_password,
  ] = parsed_text;



  // Divide the received text by a atmark into the first part and the other part.
  const matched = /^([^@]*)@(\s+)$/.exec( login_multiverse_username.trim() )

  if ( matched ) {
    return [
      matched_text,    // matched_text
      login_command ,  // login_command
      matched[2] ,     // login_username,
      matched[1] ,     // login_member_username,
      login_password,  // login_password
    ];
  } else {
    return [
      matched_text,    // matched_text
      login_command ,  // login_command
      '' ,             // login_username,
      login_username,  // login_member_username,
      login_password,  // login_password
    ];
  }

};


// Define the main procedure.
async function receive_request_proc(nargs) {
  const {
    extapp_received_text  ,
    extapp_app_id         ,
    extapp_app_user_id    ,
    botapp_post_message   ,
  } = nargs;

  {
    const result = await this.sql`
      INSERT INTO extapp_sessions
      (
        extapp_app_id,
        extapp_app_user_id,
        logged_in
      ) VALUES (
        $extapp_app_id,
        $extapp_app_user_id,
        FALSE
      )
      ON CONFLICT (
        extapp_app_id,
        extapp_app_user_id
      ) DO NOTHING
    `({
      extapp_app_id,
      extapp_app_user_id,
    }).then(e=>e.single_row_or_null);

    console.log( 'extapp_sessions', result );
  }

  // Fetch the current login information
  let extapp_login_info = await this.sql`
    SELECT
      es.extapp_app_id          ,
      es.extapp_app_user_id     ,
      (
        (
          emv.extapp_app_id IS NOT NULL
        ) OR
        (
          ( emv.extapp_app_id IS NOT NULL ) AND
          ( es.logged_in )
        )
      ) AS logged_in            ,
      es.extapp_session_attrs   ,
      emv.extapp_user_id        ,
      emv.extapp_member_user_id ,
      emv.extapp_multiversename ,
      emv.extapp_multiverse_attrs
    FROM
      extapp_sessions es
    LEFT OUTER JOIN extapp_multiverses emv ON
      es.extapp_app_id      = emv.extapp_app_id      AND
      es.extapp_app_user_id = emv.extapp_app_user_id
    WHERE
      es.extapp_app_id      = $extapp_app_id         AND
      es.extapp_app_user_id = $extapp_app_user_id
  `({
    extapp_app_id,
    extapp_app_user_id,
  }).then(e=>e.single_row_or_null);

  console.log( 'extapp_login_info ', extapp_login_info );

  // If the current login information is missing, create it.
  if ( ! extapp_login_info ) {
    await this.sql`
      INSERT INTO extapp_sessions
      (
        extapp_app_id,
        extapp_app_user_id,
        logged_in
      ) VALUES (
        $extapp_app_id,
        $extapp_app_user_id,
        FALSE
      )
    `({
      extapp_app_id,
      extapp_app_user_id,
    }).then(e=>e.single_row_or_null);

    extapp_login_info = await this.sql`
      SELECT
        extapp_app_id       ,
        extapp_app_user_id  ,
        logged_in           ,
        extapp_session_attrs
      FROM
        extapp_sessions
      WHERE
        extapp_app_id      = $extapp_app_id AND
        extapp_app_user_id  = $extapp_app_user_id
    `({
      extapp_app_id,
      extapp_app_user_id,
    }).then(e=>e.single_row_or_null);
  }



  let processed_text = extapp_received_text;
  // Remove spaces before and after the string.
  processed_text = processed_text.trim();

  // Remove ``` ```before and after the string.
  processed_text = ( /```([^]*)```/m.exec(processed_text)?.[1] )?? processed_text;

  // Again, Remove spaces before and after the string.
  processed_text = processed_text.trim();

  if ( processed_text.startsWith( '/login' ) ) {
    const parsed_text = /(\/login)\s+(\S+)\s+(\S+)/.exec( processed_text );
    //
    if ( ! parsed_text ) {
      // Show an error message to the client.
      await botapp_post_message( '入力形式が正しくありません。' ) ;

      // End
      return null;
    } else {

      /*
       * Be careful with the process_parsed_text() function.
       *
       * It parses a string like `xxxx@xxxx` and get username and member_username from it.
       */
      const [
        matched_text,
        login_command ,
        login_username,
        login_member_username,
        login_password
      ] = process_parsed_text( parsed_text );


      console.log( 'login', login_username, login_member_username, login_password );

      const row = await this.sql`
        SELECT
          u.user_id,
          u.username,
          ua.login_type                    ,
          ua.login_valid_until             ,
          ua.login_password                ,
          ua.login_password_hash           ,
          ua.login_password_salt           ,
          ua.login_password_hash_algorithm ,
          ua.login_enabled
        FROM
          users u, user_authentications ua
        WHERE
          u.user_id = ua.user_id
          AND u.user_state = $login_user_state
          AND ua.login_enabled = true
          AND u.username = $login_member_username
      `({
        login_user_state : 'active',
        login_member_username   : login_member_username,
      }).then(e=>e.single_row_or_null);

      const {
        user_id,
        login_password_salt,
      } = row;

      const login_info = ( encrypt_password({
        login_password      : login_password,
        login_password_salt : login_password_salt,
      }));

      if ( login_info.login_password_hash  === row.login_password_hash ) {

        /*
         * In case the current user successfully logged in:
         */
        await botapp_post_message( 'ログインに成功しました。' ) ;

        let extapp_login_info = await this.sql`
          UPDATE extapp_sessions
          SET logged_in = TRUE
          WHERE
            extapp_app_id     = $extapp_app_id AND
            extapp_app_user_id = $extapp_app_user_id
        `({
          extapp_app_id,
          extapp_app_user_id,
        }).then(e=>e.single_row_or_null);



        await this.commit_transaction();

        return null;
      } else {
        // Show an error message to the client.
        await botapp_post_message( 'ログインに失敗しました。' ) ;
        return null;
      }
    }

  } else if ( processed_text.startsWith( '/logoff' ) ) {

    let extapp_login_info = await this.sql`
      UPDATE extapp_sessions
      SET logged_in = FALSE
      WHERE
        extapp_app_id     = $extapp_app_id AND
        extapp_app_user_id = $extapp_app_user_id
    `({
      extapp_app_id,
      extapp_app_user_id,
    }).then(e=>e.single_row_or_null);

    await this.commit_transaction();

    await botapp_post_message( 'ログオフしました。' ) ;

    return null;
  } else if ( processed_text.startsWith( '/authorize' ) ) {
    const parsed_text = /(\/authorize)\s+(\S+)/.exec( processed_text );
    const { profile_id } = await this.read_profile_id_from_random_token({ random_token : parsed_text[2].trim() });
    const extapp_attrs = {
    };

    if ( profile_id ) {
      await this.create_or_update_extapp_multiverses_by_profile_id({
        extapp_app_id     ,
        profile_id        ,
        extapp_attrs       ,
        extapp_app_user_id ,
      });

      await this.commit_transaction();

      await botapp_post_message( '認証に成功しました。' ) ;
    } else {
      await botapp_post_message( '認証に失敗しました。' ) ;
    }

  } else if ( processed_text.startsWith( '/send' ) ) {
    console.log( ' processed_text', processed_text );
    const parsed_text = /(\/send)\s+([\S\s]*)/.exec( processed_text );

    if ( ! extapp_login_info.logged_in ) {
      await botapp_post_message( '操作を始める前にログインをして下さい。ログイン方法は\n ```/login ユーザーネーム パスワード``` とメッセージして下さい。' ) ;
      return null;
    } else {
      // extapp_login_info

      const send_config = {
        // Timeline API    ||  Multiverse API
        scope_id                : 'local',
        default_parent_user_id  : extapp_login_info.user_id,
        // username                : 'ttc',
        user_id                 : extapp_login_info.member_user_id,
        // member_username         : // 't-matsushima',
        message_text            : parsed_text[2],
        message_content_type    : 'content_text',
      };


      // // If a member user is specified as a username, convert it to a `user_id`.
      // if ( send_config.member_username != null ) {
      //   const { user_id } = (await this.username2user_id({ username : send_config.member_username }));
      //   send_config.member_user_id = user_id;
      // } else {
      //   send_config.member_user_id = null;
      // }

      // // If a user is specified as a username, convert it to a `user_id`.
      // if ( send_config.username != null ) {
      //   const { user_id } = (await this.username2user_id({ username : send_config.username }));
      //   send_config.user_id = user_id;
      // } else {
      //   send_config.user_id = null;
      //s}

      const profile = await this.sys_read_user_member_multiverse_profile({
        user_id        : send_config.default_parent_user_id,
        member_user_id : send_config.user_id,
        multiversename : send_config.scope_id,
      });

      const timeline_id = profile.profile_output_timeline_id;

      // Send the specified message to the timeline we retrieved in the previous line.
      const tweet = await this.send_tweet({
        scope_id               : send_config.scope_id,
        default_parent_user_id : send_config.default_parent_user_id,
        user_id                : send_config.user_id,
        member_user_id         : send_config.member_user_id,
        timeline_id            : timeline_id,
        message_text           : send_config.message_text,
        message_content_type   : send_config.message_content_type,
        parent_message_id      : null,
        quoted_message_id      : null,
      });

      await botapp_post_message( `送信しました。\n${'```\n'}${send_config.message_text}${'\n```\n'}` ) ;
    }
  } else {

    console.log( '/default send', extapp_login_info );

    const parsed_text = processed_text;
    // const parsed_text = /(\/send)\s+([\S\s]*)/.exec( processed_text );

    if ( ! extapp_login_info.logged_in ) {
      await botapp_post_message( '操作を始める前にログインをして下さい。ログイン方法は\n ```/login ユーザーネーム パスワード``` とメッセージして下さい。' ) ;
      return null;
    } else {
      const {
        extapp_session_attrs                     ,
        extapp_user_id          : user_id        ,
        extapp_member_user_id   : member_user_id ,
        extapp_multiversename   : multiversename ,
        extapp_multiverse_attrs ,
      } = extapp_login_info;

      // const {
      //  user_id        ,
      //  member_user_id ,
      //  multiversename ,
      // } = await this.read_multiverse_from_profile_id({ profile_id });

      // const profile = await this.read_gen2_profile({
      //   profile_id,
      // });

      const profile = await this.sys_read_user_member_multiverse_profile({
        user_id        ,
        member_user_id ,
        multiversename ,
      });

      const send_config = {
        // Timeline API    ||  Multiverse API
        scope_id                : multiversename,
        default_parent_user_id  : user_id, // FIXME
        user_id                 : member_user_id, // FIXME
        // member_username         : // 't-matsushima', // FIXME
        message_text            : processed_text,
        message_content_type    : 'content_text',
      };


      const timeline_id = profile.profile_output_timeline_id; // FIXME

      // Send the specified message to the timeline we retrieved in the previous line.
      const tweet = await this.send_tweet({
        scope_id               : multiversename, // FIXME
        default_parent_user_id : user_id,        // FIXME
        user_id                : member_user_id, // FIXME
        member_user_id         : member_user_id, // FIXME this may be incorrect
        timeline_id            : timeline_id,
        message_text           : processed_text,
        message_content_type   : 'content_text',
        parent_message_id      : null,
        quoted_message_id      : null,
      });

      await botapp_post_message( `送信しました。\n${'```\n'}${processed_text}${'\n```\n'}` ) ;
    }
  }

  // // Commit the current transaction.
  // Now transactions are automatically managed by the system.
  // await this.commit_transaction();

  // // Disconnect from the database.
  // Now it is automatically connected to the database.
  // await this.disconnect_database();
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

              /*
               * // Ask the Slack server to send a message. Recite it to the user on the Slack.
               * await web.chat.postMessage({
               *   // channel: '#general',
               *   channel: json.event.channel,
               *   text: receivedText ,
               *   // text: `The current time is ${(new Date()).toString() }`,
               *   // text: `さん、ボットからの書き込みに成功致しました！`,
               *   // text : message,
               * });
               */

              // Create a tBC API context object.
              const context = (await create_context()).setOptions({ suppressSuccessfulReport:false, autoConnect:true, autoCommit:true, showReport:true, coloredReport:true, reportMethod:'stderr' });

              // Initialize name arguments.
              const nargs={
                // VERSION 1.
                scope_id                : 'local',
                // default_parent_user_id  : null,
                // default_parent_username : 'ttc',
                // username                : 'ttc',
                // member_username         : 't-matsushima',
                message_text            : receivedText,
                message_content_type    : 'content_text',

                // VERSION 2.
                extapp_received_text    : receivedText,
                extapp_app_id           : ( 'slack' ) .trim(),
                extapp_app_user_id      : ( json.event.user ?? '' ) .trim(),
                botapp_post_message : async (in_text)=>{
                  await web.chat.postMessage({
                    // channel: '#general',
                    channel: json.event.channel,
                    text : '',
                    blocks : [
                      {
                        type : 'section',
                        text : {
                          type   : 'mrkdwn',
                          text   : in_text,
                        },
                      }
                    ],
                    // text: `The current time is ${(new Date()).toString() }`,
                    // text: `さん、ボットからの書き込みに成功致しました！`,
                    // text : message,
                  });
                },
              };

              // Execute our defined procedure in the created context.
              context.executeTransaction( receive_request_proc, nargs );

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




//  const context = await create_context();
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
//  context.executeTransaction( receive_request_proc, nargs );


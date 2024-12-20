
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

  try {
    const multiverse_url = new URL( `thankspedia-multiverse://${login_multiverse_username.trim()}` );

    let {
      hostname,
      username,
      pathname,
    } = multiverse_url;

    /*
     * Slice the string in `pathname` from the character right after the first
     * slash to the next slash or the end of the string; that is, remove all
     * slashes.
     */
    pathname = /^\/([^/]*)/.exec( pathname )?.[1] ?? '';

    return [
      matched_text   , // matched_text
      login_command  , // login_command
      hostname       , // login_username,
      username       , // login_member_username,
      pathname       , // login_multiversename,
      login_password , // login_password
    ];

  } catch ( e ) {
    return [
      matched_text  , // matched_text
      login_command , // login_command
      ''            , // login_username,
      login_username, // login_member_username,
      ''            , // login_multiversename,
      login_password, // login_password
    ];
  }


  const matched = /^([^@]*)@(\s+)$/.exec( login_multiverse_username.trim() )


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
    /*
     * Create a record to store the current session.
     */
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

  /*
   * Fetch the current login information along with
   * `extapp_multiverses` table which contains settings
   * which the administrator has set.
   */
  let extapp_login_info = await this.sql`
    SELECT
      es.extapp_app_id          ,
      es.extapp_app_user_id     ,
      ( emv.extapp_app_id IS NOT NULL ) AS enabled_login,
      (
        ( emv.extapp_app_id IS NOT NULL) AND
        ( es.logged_in )
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


  let processed_text = extapp_received_text;

  /*
   * Remove spaces before and after the string.
   */
  processed_text = processed_text.trim();

  /*
   * Remove ``` ```before and after the string.
   */
  processed_text = ( /```([^]*)```/m.exec(processed_text)?.[1] )?? processed_text;

  // Again, Remove spaces before and after the string.
  processed_text = processed_text.trim();

  if ( processed_text.startsWith( '/login' ) ) {
    /*
     * Abort if the current user is logged in.
     */
    if ( extapp_login_info.logged_in ) {
      await botapp_post_message( '既にログインしています。' ) ;
      return null;
    }

    /*
     * Process no password logging in.
     */
    if ( extapp_login_info.enabled_login && processed_text === '/login' ) {
      // Show an error message to the client.
      await botapp_post_message( 'ログインしました。' ) ;
      return null;
    }

    /*
     * TODO Check if it is allowed to overwrite the login information of the
     * current user. If overwriting is not allowed, it should abort here.
     */

    /*
     * TODO
     */

    /*
     * Parse the received text.
     */
    const parsed_text = /(\/login)\s+(\S+)\s+(\S+)/.exec( processed_text );
    //
    if ( ! parsed_text ) {
      // Show an error message to the client.
      await botapp_post_message( '入力形式が正しくありません。' ) ;

      // End
      return null;
    } else {

      /*
       * Destructure the array contains the parsed text into variables.
       *
       * Be careful with the process_parsed_text() function.
       *
       * It parses a string like `xxxx@xxxx` and get username and member_username from it.
       */
      const [
        matched_text,
        login_command ,
        login_username,
        login_member_username,
        login_multiversename,
        login_password
      ] = process_parsed_text( parsed_text );


      /*
       * 1. Check if the specified username exists.
       * 2. Check if the specified username for the member exists.
       */
      if (
        (await this.has_user_gen2({ username :        login_username })) &&
        (await this.has_user_gen2({ username : login_member_username }))
      )  {
        /*
         * If they exist, it's okay.
         */
      } else {
        /*
         * In case it is not okay.
         */
        await botapp_post_message( '入力形式が正しくありません。' ) ;
        return null;
      }

      console.log( 'login', login_username, login_member_username, login_password );

      const extapp_settings        = await this.api_read_user_member_multiverse_profile_attr({
        username                 : login_username,
        member_username          : login_username, // << BE CAREFUL HERE
        multiversename           : login_multiversename,
        profile_attrs_field_name : 'extapp_settings',
      });

      const member_extapp_settings = (await this.api_read_user_member_multiverse_profile_attr({
        username                 : login_username,
        member_username          : login_member_username,
        multiversename           : login_multiversename,
        profile_attrs_field_name : 'extapp_settings',
      }));


      console.log( 'extapp_settings', extapp_settings );
      console.log( 'member_extapp_settings', member_extapp_settings );

      /*
       * Check if password authentication is allowed by the user and the parent
       * user.
       */

      if ( extapp_settings?.allow_children_to_login_externally !== true ) {
        console.log( 'extapp_settings?.allow_children_to_login_externally',extapp_settings?.allow_children_to_login_externally );
        /*
         * In case the parent user does not allow its members to login from
         * external applications, abort the current process.
         */
        await botapp_post_message( '入力形式が正しくありません。' ) ;
        return null;
      }

      if ( member_extapp_settings?.allow_to_login_externally !== true ) {
        console.log( 'member_extapp_settings?.allow_to_login_externally',member_extapp_settings?.allow_to_login_externally );
        /*
         * In case the member user does not allow itself to login from external
         * applications, abort the current process.
         */
        await botapp_post_message( '入力形式が正しくありません。' ) ;
        return null;
      }


      /*
       * Check if the input password is valid or not at the following code.
       */
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

      /*
       * If the given password is correct, allow the current user to log in.
       */
      if ( login_info.login_password_hash  === row.login_password_hash ) {
        /*
         * The following code processes what to do when the current user
         * successfully logged in.
         */

        /*
         * Update `logged_in` flag on `extapp_sessions` table.
         */
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

        /*
         * Create a record on the `extapp_multiverses` table.
         */
        await this.create_or_update_extapp_sessions_by_multiverse({
          extapp_app_id                              ,
          username           : login_username        ,
          member_username    : login_member_username ,
          multiversename     : login_multiversename  ,
          extapp_app_user_id                         ,
          extapp_attrs       : {}                    ,
        });

        await botapp_post_message( 'ログインに成功しました。' ) ;
        await this.commit_transaction();
        return null;
      } else {
        // Show an error message to the client.
        await botapp_post_message( 'ログインに失敗しました。' ) ;
        return null;
      }
    }

  } else if ( processed_text.startsWith( '/logoff' ) ) {
    /*
     * Abort if the current user is not logged in.
     */
    if ( ! extapp_login_info.logged_in ) {
      await botapp_post_message( '操作を始める前にログインをして下さい。ログイン方法は\n ```/login ユーザーネーム パスワード``` とメッセージして下さい。' ) ;
      return null;
    }

    /*
     * Process logoff only when the current user is already logged in.
     */
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

    /*
     * Abort if the current user is logged in.
     */
    if ( extapp_login_info.logged_in ) {
      await botapp_post_message( '既にログインしています。' ) ;
      return null;
    }

    /*
     * Process the received authroization token.
     */
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
  } else {
    /*
     * Process the given command as the default command.
     */

    let parsed_text=null;
    if ( processed_text.startsWith( '/send' ) ) {
      console.log( '/send ', extapp_login_info );
      parsed_text = /(\/send)\s+([\S\s]*)/.exec( processed_text )?.[2] ?? null;

      /*
       * Whenever it failed to match the string, send an error message and abort this process.
       */
      if ( parsed_text === null ) {
        await botapp_post_message( '書式が正しくありません。' ) ;
        return null;
      }

    } else {
      console.log( '/default ', extapp_login_info );
      parsed_text = processed_text;
    }

    console.log( ' processed_text', processed_text );

    /*
     * Abort if the current user is not logged in.
     */
    if ( ! extapp_login_info.logged_in ) {
      await botapp_post_message( '操作を始める前にログインをして下さい。ログイン方法は\n ```/login ユーザーネーム パスワード``` とメッセージして下さい。' ) ;
      return null;
    }

    const {
      extapp_session_attrs                     ,
      extapp_user_id          : user_id        ,
      extapp_member_user_id   : member_user_id ,
      extapp_multiversename   : multiversename ,
      extapp_multiverse_attrs ,
    } = extapp_login_info;

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
              const context = (await create_context()).setOptions({ suppressSuccessfulReport:true, autoConnect:true, autoCommit:true, showReport:true, coloredReport:true, logger_report_method:'stderr' });


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


              try {
                // Execute our defined procedure in the created context.
                context.executeTransaction( receive_request_proc, nargs );
              } finally {
                console.log( 'context?.logger?.reportResult' , context?.logger?.reportResult );
                context?.logger?.reportResult(true);
              }

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


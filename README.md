 Slack BOT for tBC Application System
========================================================================
This is a step-by-step guide to install and start Slack BOT for tBC.


#### Install the Slack BOT for tBC ####

Clone the Git repository.

```
> git clone git@github.com:thankspedia/bottbc-slack.git
> cd bottbc-slack
```

#### Configure the Slack BOT for tBC ####

Create `.settings` file on a directory where you want to start the
server in. It is usually on the directory of the git repository.

```JSON
{
  "env" : {
    "SLACK_TOKEN":"token-SLACK-TOKEN-GOES-HERE-blabla"
  }
}
```


#### Start Slack BOT for tBC Application System ####

```sh
> cd bottbc-slack
> node index.mjs
```

#### Configure a Reverse Proxy ####

It is necessary to configure a reverse proxy server for this bot; otherwise
Slack server cannot access to your BOT server because Slack only accepts SSH
enabled HTTP servers.

In order to achive the goal, you have to set up a HTTP server such as Nginx or
other same kinds of server solutions.

See the documentation of the HTTP server you have adapted.

#### Conclusion ####

This module has been developped as a sample program of tBC Application Engine
System which is powered by an application framework [Thankspedia.js][].

[Thankspedia.js]: https://github.com/thankspedia/


